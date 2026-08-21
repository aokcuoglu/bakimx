import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test"

/**
 * BAK-195 — `/api/demo-request` hız sınırı sözleşmesi.
 *
 * Uç, süreç-içi kopya `Map` limiter'ından kanonik paylaşımlı sayaca
 * (`@/lib/rate-limit`, BAK-116) taşındı. Burada kanıtlanan dört şey:
 *
 *  1. Eşik ve 429 sözleşmesi taşıma ÖNCESİYLE birebir aynı (3 istek / 60sn / IP,
 *     dördüncüsü aynı gövdeyle 429) ve limitlenen istek DB'ye hiç yazmıyor.
 *  2. Sayaç artık süreç belleğine bağlı değil: "başka bir ECS task'ının"
 *     doldurduğu paylaşımlı kova bu süreçteki İLK isteği de keser — eskiden
 *     her task kendi `Map`'ini saydığı için fiilî eşik task sayısıyla çarpılıyordu.
 *  3. Paylaşımlı depo erişilemezken davranış değişmiyor: fail-open, koruma
 *     süreç-içi kademede aynı eşikle sürüyor.
 *  4. Anahtar uzayları ayrı: demo kotasını tüketen IP destek formunu bloke etmiyor.
 *
 * DB'siz çalışır: repo konvansiyonu gereği prisma `mock.module` ile taklit edilir
 * (`@/lib/db`nin kendi test dosyası yok — bkz. `test-mock-isolation.test.ts`).
 */

/** Kaydedilen yazmalar — "limitlenen istek DB'ye düşmez" iddiasının kanıtı. */
let demoWrites: Record<string, unknown>[] = []
let supportWrites: Record<string, unknown>[] = []

/** Paylaşımlı "veritabanı": süreç belleğinden bağımsız, sanal task'ların ortak deposu. */
const sharedRows = new Map<string, { count: number; resetAt: number }>()
let storeIsDown = false

mock.module("@/lib/db", () => ({
  prisma: {
    demoRequest: {
      create: async (args: { data: Record<string, unknown> }) => {
        demoWrites.push(args.data)
        return { id: `demo-${demoWrites.length}` }
      },
    },
    supportRequest: {
      create: async (args: { data: Record<string, unknown> }) => {
        supportWrites.push(args.data)
        return { id: `support-${supportWrites.length}` }
      },
    },
    // `resolveWorkshopIdByEmail` (destek ucu) — aday yok, talep bağsız kaydedilir.
    workshop: { findMany: async () => [] },
    user: { findMany: async () => [] },
    // Postgres deyiminin semantiğini (ON CONFLICT ile atomik artırım) taklit eder.
    $queryRaw: async (_sql: TemplateStringsArray, key: string, windowMs: number) => {
      if (storeIsDown) throw new Error("ECONNREFUSED")
      const now = Date.now()
      const row = sharedRows.get(key)
      if (!row || row.resetAt <= now) {
        const fresh = { count: 1, resetAt: now + windowMs }
        sharedRows.set(key, fresh)
        return [{ count: 1, retry_after_ms: windowMs }]
      }
      row.count += 1
      return [{ count: row.count, retry_after_ms: Math.max(0, row.resetAt - now) }]
    },
    $executeRawUnsafe: async () => 0,
  },
}))

const { POST } = await import("./route")
const { POST: postSupport } = await import("../support-request/route")
const { resetRateLimitStateForTests } = await import("@/lib/rate-limit")

const VALID_BODY = {
  name: "Ali Veli",
  businessName: "Veli Oto Servis",
  phone: "05551112233",
  city: "İstanbul",
  monthlyVehicles: "50-100",
}

const TOO_MANY = { success: false, errors: { _general: "Çok fazla istek. Lütfen biraz bekleyin." } }

function demoRequest(ip: string): Request {
  return new Request("https://www.bakimx.com/api/demo-request", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(VALID_BODY),
  })
}

function supportRequest(ip: string): Request {
  return new Request("https://www.bakimx.com/api/support-request", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({
      name: "Ali Veli",
      businessName: "Veli Oto Servis",
      email: "ali@veli.com",
      phone: "05551112233",
      subject: "Kurulum",
      message: "Kurulum hakkında bilgi almak istiyorum.",
    }),
  })
}

/** Testler varsayılan olarak yalnız süreç-içi kademeyi koşar; paylaşımlı depo test içinde açılır. */
const originalStore = process.env.RATE_LIMIT_STORE
const originalDatabaseUrl = process.env.DATABASE_URL

beforeEach(() => {
  resetRateLimitStateForTests()
  sharedRows.clear()
  storeIsDown = false
  demoWrites = []
  supportWrites = []
  process.env.RATE_LIMIT_STORE = "memory"
})

afterAll(() => {
  // `mock.module` gibi env de süreç geneli: sonraki test dosyasına sızmasın.
  if (originalStore === undefined) delete process.env.RATE_LIMIT_STORE
  else process.env.RATE_LIMIT_STORE = originalStore
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = originalDatabaseUrl
})

describe("POST /api/demo-request hız sınırı", () => {
  test("pencere içinde ilk üç istek geçer, dördüncüsü aynı 429 sözleşmesiyle döner", async () => {
    for (let i = 0; i < 3; i++) {
      const response = await POST(demoRequest("203.0.113.10"))
      expect(response.status).toBe(200)
      expect((await response.json()).success).toBe(true)
    }

    const blocked = await POST(demoRequest("203.0.113.10"))
    expect(blocked.status).toBe(429)
    expect(await blocked.json()).toEqual(TOO_MANY)
    // Limitlenen istek gövdeyi hiç okumadan döner: DB'ye yalnız üç kayıt düştü.
    expect(demoWrites).toHaveLength(3)
  })

  test("kova IP başınadır: bir IP kotasını tüketirken diğeri etkilenmez", async () => {
    for (let i = 0; i < 4; i++) await POST(demoRequest("203.0.113.11"))

    const other = await POST(demoRequest("203.0.113.12"))
    expect(other.status).toBe(200)
  })

  test("başka bir task'ın doldurduğu paylaşımlı kova bu süreçteki ilk isteği de keser", async () => {
    delete process.env.RATE_LIMIT_STORE
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test"
    // Bu "task" kovaya hiç istek yazmadı; kotayı tümüyle diğer task tüketti.
    sharedRows.set("demo-request:203.0.113.13", { count: 3, resetAt: Date.now() + 60_000 })

    const response = await POST(demoRequest("203.0.113.13"))

    expect(response.status).toBe(429)
    expect(await response.json()).toEqual(TOO_MANY)
    expect(demoWrites).toHaveLength(0)
  })

  test("paylaşımlı depo erişilemezken istek reddedilmez, süreç-içi eşik korunur", async () => {
    delete process.env.RATE_LIMIT_STORE
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test"
    storeIsDown = true

    for (let i = 0; i < 3; i++) {
      expect((await POST(demoRequest("203.0.113.14"))).status).toBe(200)
    }
    expect((await POST(demoRequest("203.0.113.14"))).status).toBe(429)
  })

  test("demo ve destek anahtarları izole: demo kotası dolan IP destek formunu kullanabilir", async () => {
    for (let i = 0; i < 4; i++) await POST(demoRequest("203.0.113.15"))
    expect(demoWrites).toHaveLength(3)

    const support = await postSupport(supportRequest("203.0.113.15"))
    expect(support.status).toBe(200)
    expect(supportWrites).toHaveLength(1)
  })
})
