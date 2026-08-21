import { beforeEach, expect, mock, test } from "bun:test"

/**
 * BAK-116: rate limit sayacının artık süreç belleğine bağlı OLMADIĞINI
 * doğrular. `@/lib/db` yerine, Postgres deyiminin semantiğini (ON CONFLICT ile
 * atomik artırım + pencere sıfırlama) JS'te taklit eden paylaşımlı bir Map
 * konur; böylece "başka bir ECS task'ı" ile aynı sayacı paylaşmak testte
 * temsil edilebilir. Gerçek SQL'in kendisi ayrıca canlı Postgres'te doğrulandı.
 */

/** "Veritabanı" — süreç belleğinden bağımsız, tüm sanal task'ların ortak deposu. */
const sharedRows = new Map<string, { count: number; resetAt: number }>()

let storeIsDown = false

mock.module("@/lib/db", () => ({
  prisma: {
    $queryRaw: async (_sql: TemplateStringsArray, key: string, windowMs: number) => {
      if (storeIsDown) throw new Error("ECONNREFUSED")
      const now = Date.now()
      const row = sharedRows.get(key)
      if (!row || row.resetAt <= now) {
        const fresh = { count: 1, resetAt: now + windowMs }
        sharedRows.set(key, fresh)
        return [{ count: 1, retry_after_ms: fresh.resetAt - now }]
      }
      row.count += 1
      return [{ count: row.count, retry_after_ms: Math.max(0, row.resetAt - now) }]
    },
    $executeRawUnsafe: async () => 0,
  },
}))

// Paylaşımlı depo yalnız bir veritabanı yapılandırıldığında devreye girer.
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test"

const { rateLimit, rateLimitLocal, resetRateLimitStateForTests } = await import("./rate-limit")

beforeEach(() => {
  // Her test taze bir "süreç" gibi başlasın: bellek kademesi ve devre kesici
  // sıfırlanır, paylaşımlı depo test içinde bilerek yönetilir.
  resetRateLimitStateForTests()
  sharedRows.clear()
  storeIsDown = false
})

test("state process'e bağlı değil: başka bir task'ın doldurduğu kova bu task'ı da keser", async () => {
  // Bu süreç kovaya HİÇ istek yazmadı; sayacı tümüyle "diğer task" tüketti.
  sharedRows.set("login:203.0.113.7", { count: 40, resetAt: Date.now() + 60_000 })

  const result = await rateLimit("login:203.0.113.7", 40, 60_000)

  expect(result.allowed).toBe(false)
  expect(result.retryAfterMs).toBeGreaterThan(0)
})

test("iki process tek sayacı paylaşır: toplam eşik task sayısıyla çarpılmaz", async () => {
  // Task A 20 istek harcar.
  for (let i = 0; i < 20; i++) {
    expect((await rateLimit("login:acct:email:a@b.com", 40, 60_000)).allowed).toBe(true)
  }

  // Task B: taze süreç belleği, aynı veritabanı.
  resetRateLimitStateForTests()

  for (let i = 0; i < 20; i++) {
    expect((await rateLimit("login:acct:email:a@b.com", 40, 60_000)).allowed).toBe(true)
  }
  // 41. istek — eski davranışta task B kendi Map'inde 21. sayardı ve GEÇERDİ.
  expect((await rateLimit("login:acct:email:a@b.com", 40, 60_000)).allowed).toBe(false)
})

test("eşik değişmedi: pencere başına tam olarak max istek geçer", async () => {
  for (let i = 0; i < 8; i++) {
    expect((await rateLimit("login:acct:email:usta@bakimx.com", 8, 60_000)).allowed).toBe(true)
  }
  const blocked = await rateLimit("login:acct:email:usta@bakimx.com", 8, 60_000)
  expect(blocked.allowed).toBe(false)
  expect(blocked.retryAfterMs).toBeGreaterThan(0)
})

test("pencere dolunca sayaç sıfırlanır", async () => {
  sharedRows.set("pwreset-ip:198.51.100.4", { count: 99, resetAt: Date.now() - 1 })

  expect((await rateLimit("pwreset-ip:198.51.100.4", 5, 60_000)).allowed).toBe(true)
  expect(sharedRows.get("pwreset-ip:198.51.100.4")?.count).toBe(1)
})

test("kovalar birbirinden bağımsız", async () => {
  sharedRows.set("login:acct:email:kilit@bakimx.com", { count: 8, resetAt: Date.now() + 60_000 })

  expect((await rateLimit("login:acct:email:kilit@bakimx.com", 8, 60_000)).allowed).toBe(false)
  expect((await rateLimit("login:acct:email:baska@bakimx.com", 8, 60_000)).allowed).toBe(true)
})

test("DATABASE_URL yokken ek altyapı gerekmeden tek process'te çalışır", async () => {
  const previous = process.env.DATABASE_URL
  delete process.env.DATABASE_URL
  try {
    for (let i = 0; i < 3; i++) {
      expect((await rateLimit("yerel:kova", 3, 60_000)).allowed).toBe(true)
    }
    expect((await rateLimit("yerel:kova", 3, 60_000)).allowed).toBe(false)
    // Paylaşımlı depoya hiç gidilmedi.
    expect(sharedRows.size).toBe(0)
  } finally {
    process.env.DATABASE_URL = previous
  }
})

test("paylaşımlı depo erişilemezse istek reddedilmez (fail-open) ve loglanır", async () => {
  storeIsDown = true
  const errors: unknown[] = []
  const originalError = console.error
  console.error = (...args: unknown[]) => errors.push(args)

  try {
    expect((await rateLimit("checkout:203.0.113.9", 5, 60_000)).allowed).toBe(true)
  } finally {
    console.error = originalError
  }

  expect(errors.length).toBe(1)
  expect(String(errors[0])).toContain("rate-limit")
})

test("depo erişilemezken süreç-içi koruma taban olarak ayakta kalır", async () => {
  storeIsDown = true
  const originalError = console.error
  console.error = () => {}

  try {
    for (let i = 0; i < 40; i++) {
      expect((await rateLimit("login:198.51.100.20", 40, 60_000)).allowed).toBe(true)
    }
    // Fail-open koruma tümüyle kapanmak demek değil: bu süreç yine 40'ta keser.
    expect((await rateLimit("login:198.51.100.20", 40, 60_000)).allowed).toBe(false)
  } finally {
    console.error = originalError
  }
})

/**
 * BAK-196: yüksek frekanslı OKUMA yollarının bilerek süreç-içi kalan kademesi.
 * Paylaşımlı sayaç her çağrıda bir satır yazar; 4 saniyede bir yoklanan bir uçta
 * bu, korunan işten pahalı bir yazma yükü demektir.
 */
test("rateLimitLocal paylaşımlı depoya hiç gitmez, eşiği süreç belleğinde uygular", async () => {
  for (let i = 0; i < 5; i++) {
    expect(rateLimitLocal("live-chat:poll:203.0.113.30", 5, 60_000).allowed).toBe(true)
  }

  const blocked = rateLimitLocal("live-chat:poll:203.0.113.30", 5, 60_000)
  expect(blocked.allowed).toBe(false)
  expect(blocked.retryAfterMs).toBeGreaterThan(0)
  // DATABASE_URL tanımlı olmasına rağmen tek bir sayaç satırı bile yazılmadı.
  expect(sharedRows.size).toBe(0)
})

test("rateLimitLocal kovası paylaşımlı yolla aynı depoyu kullanır ama anahtarlar ayrıdır", async () => {
  for (let i = 0; i < 5; i++) rateLimitLocal("live-chat:poll:203.0.113.31", 5, 60_000)
  expect(rateLimitLocal("live-chat:poll:203.0.113.31", 5, 60_000).allowed).toBe(false)

  // Aynı IP'nin YAZMA kotası ayrı anahtarda: yoklama kotası onu tüketmez.
  expect((await rateLimit("live-chat:send:203.0.113.31", 5, 60_000)).allowed).toBe(true)
})

test("rateLimitLocal süresi dolan kovayı sıfırlar", () => {
  for (let i = 0; i < 3; i++) rateLimitLocal("kisa:pencere", 3, 5)
  expect(rateLimitLocal("kisa:pencere", 3, 5).allowed).toBe(false)

  Bun.sleepSync(10)
  expect(rateLimitLocal("kisa:pencere", 3, 5).allowed).toBe(true)
})
