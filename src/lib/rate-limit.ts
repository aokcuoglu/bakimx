import { prisma } from "@/lib/db"

export type RateLimitResult = { allowed: boolean; retryAfterMs: number }

const WINDOW_MS = 60_000
const MAX_REQUESTS = 30

/** Paylaşımlı depo hata verdikten sonra bu süre boyunca yeniden denenmez. */
const BREAKER_COOLDOWN_MS = 30_000
/** Süresi dolmuş sayaç satırlarının süpürülme sıklığı. */
const SWEEP_INTERVAL_MS = 5 * 60_000
/** Aynı depo hatasının log'a tekrar yazılma sıklığı (log seli olmasın). */
const LOG_THROTTLE_MS = 60_000
/** Süpürmede silinmeden önce süresi dolmuş satırların bekletildiği pay. */
const SWEEP_GRACE = "1 hour"

/**
 * Süreç-içi birinci kademe. Paylaşımlı sayaç ASIL kapıdır; bu Map yalnız
 * (a) açık bir seli veritabanına hiç gitmeden keser, (b) paylaşımlı depo
 * erişilemezken bugünkü korumayı taban olarak ayakta tutar.
 */
const localBuckets = new Map<string, { count: number; resetTime: number }>()

let breakerOpenUntil = 0
let lastSweepAt = 0
let lastErrorLogAt = 0

/**
 * Paylaşımlı sayaç yalnız bir veritabanı varken kullanılır. `DATABASE_URL`
 * yoksa (birim testleri, `next build`) ya da `RATE_LIMIT_STORE=memory` ile
 * bilerek kapatıldıysa süreç-içi kademe tek başına çalışır — yerel geliştirme
 * ek altyapı istemez.
 */
function sharedStoreEnabled(): boolean {
  if (process.env.RATE_LIMIT_STORE === "memory") return false
  return Boolean(process.env.DATABASE_URL)
}

function logStoreFailure(error: unknown): void {
  const now = Date.now()
  if (now - lastErrorLogAt < LOG_THROTTLE_MS) return
  lastErrorLogAt = now
  console.error(
    "[rate-limit] paylaşımlı sayaca erişilemedi; istekler geçici olarak yalnız süreç-içi limitle korunuyor",
    error
  )
}

/** Bugünkü sabit-pencere davranışının birebir aynısı, süreç belleğinde. */
function localRateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const entry = localBuckets.get(key)

  if (!entry || now > entry.resetTime) {
    localBuckets.set(key, { count: 1, resetTime: now + windowMs })
    return { allowed: true, retryAfterMs: 0 }
  }

  if (entry.count >= max) {
    return { allowed: false, retryAfterMs: entry.resetTime - now }
  }

  entry.count += 1
  return { allowed: true, retryAfterMs: 0 }
}

/**
 * Tek deyimde atomik artırım: `ON CONFLICT` çakışan satırı kilitler, yani iki
 * ECS task'ı aynı anda gelse bile sayaç bir kez artar. Pencere sınırı
 * uygulamanın değil VERİTABANININ saatiyle (`now()`) hesaplanır — task'ların
 * saatleri kaysa da tek bir pencere geçerlidir.
 *
 * `null` dönerse karar verilememiştir (depo kapalı/erişilemez) ve çağıran
 * süreç-içi sonuca düşer.
 */
async function sharedRateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<RateLimitResult | null> {
  if (!sharedStoreEnabled()) return null
  if (Date.now() < breakerOpenUntil) return null

  try {
    const rows = await prisma.$queryRaw<{ count: number; retry_after_ms: number }[]>`
      INSERT INTO "RateLimitCounter" ("key", "count", "resetAt")
      VALUES (${key}, 1, now() + (${windowMs}::double precision * interval '1 millisecond'))
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimitCounter"."resetAt" <= now() THEN 1
          ELSE "RateLimitCounter"."count" + 1
        END,
        "resetAt" = CASE
          WHEN "RateLimitCounter"."resetAt" <= now()
            THEN now() + (${windowMs}::double precision * interval '1 millisecond')
          ELSE "RateLimitCounter"."resetAt"
        END
      RETURNING
        "count",
        GREATEST(0, EXTRACT(EPOCH FROM ("resetAt" - now())) * 1000)::int AS retry_after_ms
    `

    const row = rows[0]
    if (!row) return null

    const count = Number(row.count)
    if (count <= max) return { allowed: true, retryAfterMs: 0 }
    return { allowed: false, retryAfterMs: Number(row.retry_after_ms) }
  } catch (error) {
    // Fail-open: depo erişilemezken istek REDDEDİLMEZ. Servis hizmet vermeye
    // devam eder, koruma süreç-içi kademeye iner ve durum loglanır.
    breakerOpenUntil = Date.now() + BREAKER_COOLDOWN_MS
    logStoreFailure(error)
    return null
  }
}

/**
 * Süresi dolmuş satırların temizliği. Ayrı bir cron'a bağlamak yerine istek
 * yolundan seyrek (süreç başına 5 dakikada bir) ve bekletmeden tetiklenir;
 * satırlar dakikalık ömürlü olduğu için hacim küçüktür.
 */
function sweepExpired(): void {
  const now = Date.now()
  if (now - lastSweepAt < SWEEP_INTERVAL_MS) return
  lastSweepAt = now

  for (const [key, entry] of localBuckets) {
    if (now > entry.resetTime) localBuckets.delete(key)
  }

  if (!sharedStoreEnabled() || now < breakerOpenUntil) return
  void prisma
    .$executeRawUnsafe(
      `DELETE FROM "RateLimitCounter" WHERE "resetAt" < now() - interval '${SWEEP_GRACE}'`
    )
    .catch(() => {
      // Süpürme en iyi çabadır; başarısızlığı rate limit kararını etkilemez.
    })
}

/**
 * Süreçler arası paylaşımlı sabit-pencere rate limiter (BAK-116).
 *
 * Sayaç Postgres'te tutulur, yani ECS'te kaç task koşarsa koşsun eşik TEKTİR;
 * eskiden her task kendi `Map`'ini saydığı için etkin eşik task sayısıyla
 * çarpılıyordu (`docs/operations/platform-admin-model.md` §3.3).
 *
 * İki kademe vardır ve süreç-içi kademe paylaşımlı olandan ASLA daha gevşek
 * değildir: bir sürecin gördüğü istekler tüm isteklerin alt kümesi olduğundan,
 * süreç-içi sayaç eşiği aştıysa paylaşımlı sayaç da aşmıştır.
 *
 * @param key      kova anahtarı (ör. `login:<ip>`)
 * @param max      pencere başına izin verilen istek (varsayılan 30)
 * @param windowMs pencere uzunluğu, ms (varsayılan 60sn)
 */
export async function rateLimit(
  key: string,
  max: number = MAX_REQUESTS,
  windowMs: number = WINDOW_MS
): Promise<RateLimitResult> {
  const local = localRateLimit(key, max, windowMs)
  if (!local.allowed) return local

  sweepExpired()

  const shared = await sharedRateLimit(key, max, windowMs)
  return shared ?? local
}

/** Yalnız testler için: süreç-içi kademeyi ve devre kesiciyi sıfırlar. */
export function resetRateLimitStateForTests(): void {
  localBuckets.clear()
  breakerOpenUntil = 0
  lastSweepAt = 0
  lastErrorLogAt = 0
}
