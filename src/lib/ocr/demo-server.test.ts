import { beforeEach, afterEach, describe, expect, test } from "bun:test"
import sharp from "sharp"
import { DEMO_COOKIE, demoExpectedOrigin, TEST_SITE_KEY, TEST_SECRET_KEY, demoClientIp, readDemoCookie, signDemoCookie, sameDemoOrigin, readDemoForm, normalizeDemoImage, verifyDemoBot, publicDemoFields } from "./demo-server"
import { demoQuotaKeys, reserveDemoQuota, refundDemoQuota, demoQuotaStatus } from "./demo-quota"
import type { RegistrationOcrResult } from "./types"
import type { prisma } from "@/lib/db"

const secret = "unit-test-secret-that-is-at-least-32-characters"
function memoryDatabase() {
  const rows = new Map<string, { key: string; count: number; resetAt: Date }>()
  let queue = Promise.resolve()
  const tx = {
    $executeRaw: async () => 1,
    $queryRaw: async () => [{ now: new Date() }],
    rateLimitCounter: {
      findMany: async ({ where }: { where: { key: { in: string[] }; resetAt: { gt: Date } } }) => [...rows.values()].filter(r => where.key.in.includes(r.key) && r.resetAt > where.resetAt.gt),
      findUnique: async ({ where }: { where: { key: string } }) => rows.get(where.key),
      upsert: async ({ where, create, update }: { where: { key: string }; create: { key: string; count: number; resetAt: Date }; update: { count: number; resetAt: Date } }) => rows.set(where.key, rows.has(where.key) ? { key: where.key, ...update } : create),
      deleteMany: async ({ where }: { where: { key: { in: string[] } } }) => where.key.in.forEach(k => rows.delete(k)),
    },
  }
  const database = { $transaction: async (fn: (client: typeof tx) => Promise<unknown>) => {
    const running = queue.then(() => fn(tx))
    queue = running.then(() => undefined, () => undefined)
    return running
  } } as unknown as typeof prisma
  return { database, rows }
}
describe("public demo trust boundaries", () => {
  let previousOrigin: string | undefined
  beforeEach(() => { previousOrigin = process.env.DEMO_OCR_ORIGIN; process.env.DEMO_OCR_ORIGIN = "https://bakimx.com" })
  afterEach(() => {
    if (previousOrigin === undefined) delete process.env.DEMO_OCR_ORIGIN
    else process.env.DEMO_OCR_ORIGIN = previousOrigin
  })
  test("cookie cannot be edited and same-origin is required", () => {
    const signed = signDemoCookie(secret)
    const request = (cookie: string) => new Request("https://bakimx.com/api/demo-ocr", { headers: { cookie: `${DEMO_COOKIE}=${cookie}` } })
    expect(readDemoCookie(request(signed), secret)).toBe(signed.split(".")[0])
    expect(readDemoCookie(request(signed.replace(/.$/, signed.endsWith("a") ? "b" : "a")), secret)).toBeNull()
    expect(sameDemoOrigin(request(signed))).toBe(false)
    expect(sameDemoOrigin(new Request("http://bakimx.com/api/demo-ocr", { headers: { origin: "https://evil.example" } }))).toBe(false)
    expect(sameDemoOrigin(new Request("http://bakimx.com/api/demo-ocr", { headers: { host: "bakimx.com", origin: "https://bakimx.com" } }))).toBe(true)
  })
  test("standalone internal URL uses configured public origin and requires exact Host", async () => {
    const request = new Request("http://0.0.0.0:3000/api/demo-ocr", { headers: { host: "bakimx.com", origin: "https://bakimx.com" } })
    expect(sameDemoOrigin(request)).toBe(true)
    const config = { secret, siteKey: "real-site", botSecret: "real-secret", testKeys: false, globalMax: 50 }
    expect(await verifyDemoBot("token", request, "1.2.3.4", config, (async () => Response.json({ success: true, hostname: "bakimx.com", action: "demo_ocr" })) as typeof fetch)).toBe(true)
    for (const host of ["evil.example", "bakimx.com:443", ""]) {
      expect(sameDemoOrigin(new Request(request.url, { headers: { host, origin: "https://bakimx.com", "x-forwarded-host": "bakimx.com" } }))).toBe(false)
    }
    for (const configured of ["http://bakimx.com", "https://user:password@bakimx.com", "https://bakimx.com/path", "https://bakimx.com?query=1", "https://bakimx.com#fragment", ""]) {
      process.env.DEMO_OCR_ORIGIN = configured
      expect(demoExpectedOrigin(request)).toBeNull()
    }
  })
  test("only ALB last XFF hop counts; IP variants normalize", () => {
    const ip = (xff: string) => demoClientIp(new Request("https://bakimx.com", { headers: { "x-forwarded-for": xff } }))
    expect(ip("1.2.3.4, 5.6.7.8")).toBe("5.6.7.8")
    expect(ip("1.2.3.4, garbage")).toBeNull()
    expect(ip("[2001:0db8:0:0:0:0:0:1]:1234")).toBe(ip("2001:db8::1"))
  })
  test("Turnstile wrong action/hostname fails closed", async () => {
    const config = { secret, siteKey: "real-site", botSecret: "real-secret", testKeys: false, globalMax: 50 }
    const request = new Request("https://bakimx.com/api/demo-ocr", { headers: { host: "bakimx.com" } })
    for (const response of [{ success: false }, { success: true, hostname: "evil.example", action: "demo_ocr" }, { success: true, hostname: "bakimx.com", action: "other" }]) {
      expect(await verifyDemoBot("token", request, "1.2.3.4", config, (async () => Response.json(response)) as typeof fetch)).toBe(false)
    }
    expect(await verifyDemoBot("token", request, "1.2.3.4", config, (async () => { throw new Error("offline") }) as typeof fetch)).toBe(false)
    expect(await verifyDemoBot("token", request, "1.2.3.4", config, (async () => Response.json({ success: true, hostname: "bakimx.com", action: "demo_ocr" })) as typeof fetch)).toBe(true)
  })
  test("official live test response allowed only on local development with exact dummy pair", async () => {
    const previous = process.env.NODE_ENV
    try {
      Object.assign(process.env, { NODE_ENV: "development" })
      const request = new Request("http://localhost:3000/api/demo-ocr")
      const config = { secret, siteKey: TEST_SITE_KEY, botSecret: TEST_SECRET_KEY, testKeys: true, globalMax: 50 }
      const data = { success: true, hostname: "example.com", metadata: { result_with_testing_key: true } }
      const fetcher = (async () => Response.json(data)) as typeof fetch
      expect(await verifyDemoBot("token", request, "127.0.0.1", config, fetcher)).toBe(true)
      expect(await verifyDemoBot("token", request, "127.0.0.1", { ...config, botSecret: "real-secret" }, fetcher)).toBe(false)
      expect(await verifyDemoBot("token", new Request("https://bakimx.com/api/demo-ocr"), "1.2.3.4", config, fetcher)).toBe(false)
      Object.assign(process.env, { NODE_ENV: "production" })
      expect(await verifyDemoBot("token", request, "127.0.0.1", config, fetcher)).toBe(false)
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV
      else Object.assign(process.env, { NODE_ENV: previous })
    }
  })
  test("stream size capped without Content-Length, reader canceled", async () => {
    let canceled = false
    const stream = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)) }, cancel() { canceled = true } })
    const request = new Request("https://bakimx.com", { method: "POST", headers: { "Content-Type": "multipart/form-data; boundary=test" }, body: stream, duplex: "half" } as RequestInit)
    await expect(readDemoForm(request)).rejects.toThrow()
    expect(canceled).toBe(true)
  })
  test("strict decode rejects junk, wrong MIME and oversized dimensions", async () => {
    await expect(normalizeDemoImage(new File(["junk"], "test.jpg", { type: "image/jpeg" }))).rejects.toThrow()
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } }).png().toBuffer()
    await expect(normalizeDemoImage(new File([png], "test.jpg", { type: "image/jpeg" }))).rejects.toThrow()
    const decoded = await normalizeDemoImage(new File([png], "test.png", { type: "image/png" }))
    expect((await sharp(decoded).metadata()).format).toBe("jpeg")
    const large = await sharp({ create: { width: 5001, height: 5000, channels: 3, background: "white" } }).png().toBuffer()
    await expect(normalizeDemoImage(new File([large], "large.png", { type: "image/png" }))).rejects.toThrow()
  })
  test("owner/identity/raw text excluded and empty values never filled", () => {
    const result = { provider: "anthropic", plate: { value: "34 ABC 123" }, vin: { value: " " }, ownerName: { value: "Private" }, identityOrTaxNumber: { value: "12345678901" }, rawText: "Private" } as RegistrationOcrResult
    expect(publicDemoFields(result).map(f => f.key)).toEqual(["plate"])
    expect(publicDemoFields({ ...result, provider: "mock" })).toEqual([])
  })
})
describe("shared quota reservations", () => {
  test("concurrent same browser or same IP grants one reservation", async () => {
    for (const same of ["browser", "ip"]) {
      const { database } = memoryDatabase()
      const results = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => reserveDemoQuota(demoQuotaKeys(same === "browser" ? "one" : String(i), same === "ip" ? "one" : String(i), secret), 50, database)))
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1)
    }
  })
  test("global cap counts all unique reservations", async () => {
    const { database } = memoryDatabase()
    const results = await Promise.allSettled(Array.from({ length: 51 }, (_, i) => reserveDemoQuota(demoQuotaKeys(String(i), String(i), secret), 50, database)))
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(50)
  })
  test("failed OCR refunds only success slots; attempts and global costs remain", async () => {
    const { database, rows } = memoryDatabase()
    const keys = demoQuotaKeys("browser", "ip", secret)
    for (let i = 0; i < 3; i++) {
      const reservation = await reserveDemoQuota(keys, 50, database)
      await refundDemoQuota(reservation, database)
    }
    await expect(reserveDemoQuota(keys, 50, database)).rejects.toThrow("limited")
    expect(rows.get(keys.globalKey)?.count).toBe(3)
    expect(rows.has(keys.browserKey)).toBe(false)
  })
  test("stale or duplicate refund cannot release a newer reservation", async () => {
    const { database, rows } = memoryDatabase()
    const keys = demoQuotaKeys("browser", "ip", secret)
    const previous = await reserveDemoQuota(keys, 50, database)
    await refundDemoQuota(previous, database)
    await reserveDemoQuota(keys, 50, database)
    // Even if two reservations begin in the same millisecond, their markers differ.
    rows.get(keys.browserKey)!.resetAt = previous.stamp
    await refundDemoQuota(previous, database)
    await expect(demoQuotaStatus(keys, 50, database)).rejects.toThrow("used")
    expect(rows.has(keys.ipKey)).toBe(true)
  })
  test("used is durable and store outage denies", async () => {
    const { database } = memoryDatabase()
    const keys = demoQuotaKeys("browser", "ip", secret)
    await reserveDemoQuota(keys, 50, database)
    await expect(demoQuotaStatus(keys, 50, database)).rejects.toThrow("used")
    const unavailable = { $transaction: async () => { throw new Error("offline") } } as unknown as typeof prisma
    await expect(reserveDemoQuota(keys, 50, unavailable)).rejects.toThrow("offline")
  })
})
