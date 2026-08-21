import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test"

import { DEFAULT_SCHEDULE } from "@/lib/live-chat/schedule"

mock.module("server-only", () => ({}))

/**
 * BAK-196 — ziyaretçiye açık live-chat uçlarının hız sınırı sözleşmesi.
 *
 * `src/lib/live-chat/server.ts` kendi süreç-içi `Map` limiter'ını taşıyordu ve
 * ters polariteliydi (`true` = engellendi). Kaldırıldı; uçlar kanonik
 * `@/lib/rate-limit`e bağlandı. Burada kanıtlanan dört şey:
 *
 *  1. YAZMA uçları (`start`, `send`) paylaşımlı sayacı kullanır: "başka bir ECS
 *     task'ının" doldurduğu kova bu süreçteki İLK isteği de keser. Eskiden her
 *     task kendi `Map`'ini saydığı için fiilî eşik task sayısıyla çarpılıyordu —
 *     3 task'ta 20 mesaj/dk pratikte 60/dk idi.
 *  2. Eşikler ve 429 gövdeleri taşıma ÖNCESİYLE birebir aynı; polarite çevrimi
 *     sessizce ters dönmemiş (geçen istek geçiyor, aşan istek kesiliyor).
 *  3. Paylaşımlı depo erişilemezken davranış değişmiyor: fail-open, koruma
 *     süreç-içi kademede aynı eşikle sürüyor.
 *  4. YOKLAMA ucu bilerek süreç-içi kaldı ve paylaşımlı sayaca HİÇ yazmıyor —
 *     4 saniyelik yoklama, okuduğu işten pahalı bir yazma yükü üretmesin.
 *
 * DB'siz çalışır: repo konvansiyonu gereği prisma `mock.module` ile taklit
 * edilir (`@/lib/db`nin kendi test dosyası yok — `test-mock-isolation.test.ts`).
 * `@/lib/live-chat/notify` MOCKLANMAZ: kendi test dosyası var (guardrails §7) ve
 * `ADMIN_EMAILS` boşken zaten hiçbir şey göndermiyor.
 *
 * `server-only` de sahtelenir: paket `node_modules`'te yoktur (`next build`
 * onu kendi derlenmiş kopyasına yönlendirir), dolayısıyla `bun test` altında
 * `import "server-only"` içeren hiçbir modül çözülemez. Sahte, gerçeğinin
 * sunucu tarafındaki karşılığıyla aynıdır: yan etkisiz, boş bir modül.
 */

/** Kaydedilen yazmalar — "limitlenen istek DB'ye düşmez" iddiasının kanıtı. */
let conversationWrites: Record<string, unknown>[] = []
let messageWrites: Record<string, unknown>[] = []

/** Paylaşımlı "veritabanı": süreç belleğinden bağımsız, sanal task'ların ortak deposu. */
const sharedRows = new Map<string, { count: number; resetAt: number }>()
let storeIsDown = false

const TOKEN = "gorusme-tokeni-0123456789"

function conversationRow() {
  return {
    id: "conv-1",
    publicToken: TOKEN,
    status: "open",
    visitorName: "Ali Veli",
    visitorEmail: "ali@veli.com",
    visitorPhone: null,
    startedOffline: false,
    pageUrl: null,
    lastMessageAt: new Date(),
    lastVisitorMessageAt: new Date(),
    lastAgentMessageAt: null,
    visitorLastReadAt: null,
    closedAt: null,
  }
}

mock.module("@/lib/db", () => ({
  prisma: {
    liveChatConversation: {
      create: async (args: { data: Record<string, unknown> }) => {
        conversationWrites.push(args.data)
        return { ...conversationRow(), messages: [] }
      },
      findUnique: async () => conversationRow(),
      update: async () => conversationRow(),
    },
    liveChatMessage: {
      create: async (args: { data: Record<string, unknown> }) => {
        messageWrites.push(args.data)
        return { id: `msg-${messageWrites.length}`, sender: "visitor", body: "merhaba", createdAt: new Date() }
      },
      findMany: async () => [],
    },
    liveChatSettings: {
      upsert: async () => ({
        enabled: true,
        timezone: "Europe/Istanbul",
        schedule: DEFAULT_SCHEDULE,
        holidays: [],
        greeting: "Merhaba",
        offlineMessage: "Şu an çevrimdışıyız",
        responseNote: "Birkaç dakika",
        updatedAt: new Date(),
        updatedByEmail: null,
      }),
    },
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

const { POST: startConversation } = await import("./conversations/route")
const { GET: pollMessages, POST: sendMessage } = await import("./messages/route")
const { resetRateLimitStateForTests } = await import("@/lib/rate-limit")

function startRequest(ip: string): Request {
  return new Request("https://www.bakimx.com/api/live-chat/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({
      name: "Ali Veli",
      email: "ali@veli.com",
      message: "Fiyat hakkında bilgi almak istiyorum.",
    }),
  })
}

function sendRequest(ip: string): Request {
  return new Request("https://www.bakimx.com/api/live-chat/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ token: TOKEN, body: "merhaba" }),
  })
}

function pollRequest(ip: string): Request {
  return new Request(`https://www.bakimx.com/api/live-chat/messages?token=${TOKEN}`, {
    headers: { "x-forwarded-for": ip },
  })
}

/** Testler varsayılan olarak yalnız süreç-içi kademeyi koşar; paylaşımlı depo test içinde açılır. */
const originalStore = process.env.RATE_LIMIT_STORE
const originalDatabaseUrl = process.env.DATABASE_URL

function useSharedStore(): void {
  delete process.env.RATE_LIMIT_STORE
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test"
}

beforeEach(() => {
  resetRateLimitStateForTests()
  sharedRows.clear()
  storeIsDown = false
  conversationWrites = []
  messageWrites = []
  process.env.RATE_LIMIT_STORE = "memory"
})

afterAll(() => {
  // `mock.module` gibi env de süreç geneli: sonraki test dosyasına sızmasın.
  if (originalStore === undefined) delete process.env.RATE_LIMIT_STORE
  else process.env.RATE_LIMIT_STORE = originalStore
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = originalDatabaseUrl
})

describe("POST /api/live-chat/conversations — görüşme başlatma", () => {
  test("eşik değişmedi: dakikada 3 görüşme geçer, dördüncüsü 429 döner", async () => {
    for (let i = 0; i < 3; i++) {
      expect((await startConversation(startRequest("203.0.113.20"))).status).toBe(201)
    }

    const blocked = await startConversation(startRequest("203.0.113.20"))
    expect(blocked.status).toBe(429)
    expect(await blocked.json()).toEqual({
      success: false,
      errors: { _general: "Çok fazla istek. Lütfen biraz bekleyin." },
    })
    // Limitlenen istek gövdeyi hiç okumadan döner: DB'ye yalnız üç görüşme düştü.
    expect(conversationWrites).toHaveLength(3)
  })

  test("başka bir task'ın doldurduğu paylaşımlı kova bu süreçteki ilk isteği de keser", async () => {
    useSharedStore()
    // Bu "task" kovaya hiç istek yazmadı; kotayı tümüyle diğer task tüketti.
    sharedRows.set("live-chat:start:203.0.113.21", { count: 3, resetAt: Date.now() + 60_000 })

    expect((await startConversation(startRequest("203.0.113.21"))).status).toBe(429)
    expect(conversationWrites).toHaveLength(0)
  })

  test("kova IP başınadır: bir IP kotasını tüketirken diğeri etkilenmez", async () => {
    for (let i = 0; i < 4; i++) await startConversation(startRequest("203.0.113.22"))

    expect((await startConversation(startRequest("203.0.113.23"))).status).toBe(201)
  })
})

describe("POST /api/live-chat/messages — mesaj gönderme", () => {
  test("eşik task sayısıyla çarpılmaz: iki task tek sayacı paylaşır", async () => {
    useSharedStore()

    // Task A kotanın tamamını harcar.
    for (let i = 0; i < 20; i++) {
      expect((await sendMessage(sendRequest("203.0.113.24"))).status).toBe(201)
    }

    // Task B: taze süreç belleği, aynı veritabanı. Eski davranışta kendi Map'inde
    // 1. mesajı sayar ve GEÇİRİRDİ — fiilî eşik 40/dk olurdu.
    resetRateLimitStateForTests()

    const blocked = await sendMessage(sendRequest("203.0.113.24"))
    expect(blocked.status).toBe(429)
    expect(await blocked.json()).toEqual({
      success: false,
      errors: { _general: "Çok hızlı yazıyorsunuz. Lütfen biraz bekleyin." },
    })
    expect(messageWrites).toHaveLength(20)
  })

  test("paylaşımlı depo erişilemezken istek reddedilmez, süreç-içi eşik korunur", async () => {
    useSharedStore()
    storeIsDown = true
    const originalError = console.error
    console.error = () => {}

    try {
      for (let i = 0; i < 20; i++) {
        expect((await sendMessage(sendRequest("203.0.113.25"))).status).toBe(201)
      }
      expect((await sendMessage(sendRequest("203.0.113.25"))).status).toBe(429)
    } finally {
      console.error = originalError
    }
  })

  test("gönderme ve başlatma anahtarları izole: mesaj kotası görüşme açmayı bloke etmez", async () => {
    useSharedStore()
    sharedRows.set("live-chat:send:203.0.113.26", { count: 20, resetAt: Date.now() + 60_000 })

    expect((await sendMessage(sendRequest("203.0.113.26"))).status).toBe(429)
    expect((await startConversation(startRequest("203.0.113.26"))).status).toBe(201)
  })
})

describe("GET /api/live-chat/messages — yoklama", () => {
  test("paylaşımlı sayaca hiç yazmaz: 4 sn'lik yoklama DB yazma yükü üretmez", async () => {
    useSharedStore()

    for (let i = 0; i < 30; i++) {
      expect((await pollMessages(pollRequest("203.0.113.27"))).status).toBe(200)
    }

    // Karar tümüyle süreç belleğinde verildi — tek bir sayaç satırı bile yazılmadı.
    expect(sharedRows.size).toBe(0)
  })

  test("sınır kalkmadı: aynı süreçte dakikada 120 yoklama sonrası 429 döner", async () => {
    for (let i = 0; i < 120; i++) {
      expect((await pollMessages(pollRequest("203.0.113.28"))).status).toBe(200)
    }

    const blocked = await pollMessages(pollRequest("203.0.113.28"))
    expect(blocked.status).toBe(429)
    expect(await blocked.json()).toEqual({ success: false, errors: { _general: "Çok fazla istek." } })
  })
})
