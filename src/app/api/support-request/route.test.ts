import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test"

/**
 * BAK-195 — `/api/support-request` hız sınırı sözleşmesi.
 *
 * Kardeş uçla (`/api/demo-request`) aynı taşıma: süreç-içi kopya `Map` yerine
 * kanonik paylaşımlı sayaç. Eşik (3 istek / 60sn / IP), 429 gövdesi ve durum
 * kodu değişmedi; değişen, sayacın ECS task'ları arasında PAYLAŞILMASI.
 */

let supportWrites: Record<string, unknown>[] = []

/** Paylaşımlı "veritabanı" — sanal task'ların ortak deposu. */
const sharedRows = new Map<string, { count: number; resetAt: number }>()

mock.module("@/lib/db", () => ({
  prisma: {
    supportRequest: {
      create: async (args: { data: Record<string, unknown> }) => {
        supportWrites.push(args.data)
        return { id: `support-${supportWrites.length}` }
      },
    },
    // `resolveWorkshopIdByEmail`: tek aday çıkarsa talep o atölyeye bağlanır.
    workshop: { findMany: async () => [{ id: "ws-1" }] },
    user: { findMany: async () => [] },
    $queryRaw: async (_sql: TemplateStringsArray, key: string, windowMs: number) => {
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
const { resetRateLimitStateForTests } = await import("@/lib/rate-limit")

const TOO_MANY = { success: false, errors: { _general: "Çok fazla istek. Lütfen biraz bekleyin." } }

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

const originalStore = process.env.RATE_LIMIT_STORE
const originalDatabaseUrl = process.env.DATABASE_URL

beforeEach(() => {
  resetRateLimitStateForTests()
  sharedRows.clear()
  supportWrites = []
  process.env.RATE_LIMIT_STORE = "memory"
})

afterAll(() => {
  if (originalStore === undefined) delete process.env.RATE_LIMIT_STORE
  else process.env.RATE_LIMIT_STORE = originalStore
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = originalDatabaseUrl
})

describe("POST /api/support-request hız sınırı", () => {
  test("pencere içinde ilk üç istek geçer, dördüncüsü aynı 429 sözleşmesiyle döner", async () => {
    for (let i = 0; i < 3; i++) {
      const response = await POST(supportRequest("198.51.100.10"))
      expect(response.status).toBe(200)
      expect((await response.json()).success).toBe(true)
    }

    const blocked = await POST(supportRequest("198.51.100.10"))
    expect(blocked.status).toBe(429)
    expect(await blocked.json()).toEqual(TOO_MANY)
    expect(supportWrites).toHaveLength(3)
    // Taşıma kiracı bağını da bozmamalı: tek aday bulunduğunda talep bağlanır.
    expect(supportWrites[0].workshopId).toBe("ws-1")
  })

  test("kova IP başınadır: bir IP kotasını tüketirken diğeri etkilenmez", async () => {
    for (let i = 0; i < 4; i++) await POST(supportRequest("198.51.100.11"))

    expect((await POST(supportRequest("198.51.100.12"))).status).toBe(200)
  })

  test("başka bir task'ın doldurduğu paylaşımlı kova bu süreçteki ilk isteği de keser", async () => {
    delete process.env.RATE_LIMIT_STORE
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test"
    sharedRows.set("support-request:198.51.100.13", { count: 3, resetAt: Date.now() + 60_000 })

    const response = await POST(supportRequest("198.51.100.13"))

    expect(response.status).toBe(429)
    expect(await response.json()).toEqual(TOO_MANY)
    expect(supportWrites).toHaveLength(0)
  })
})
