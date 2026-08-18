import { afterEach, describe, expect, test } from "bun:test"
import { resetAdvisorProvider } from "@/lib/advisor/provider"
import { askWithTimeout, POST } from "./route"

const request = (body: unknown, ip = "198.51.100.10") => new Request("http://localhost/api/assistant/ask", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
  body: JSON.stringify(body),
})

afterEach(() => {
  process.env.LANDING_ASSISTANT_AI = "off"
  process.env.AI_PROVIDER = "mock"
  resetAdvisorProvider()
})

describe("POST /api/assistant/ask", () => {
  test("bayrak kapalıyken sağlayıcıya gitmeden fallback döner", async () => {
    process.env.LANDING_ASSISTANT_AI = "off"
    expect(await (await POST(request({ question: "stok" }))).json()).toEqual({ success: true, mode: "fallback" })
  })

  test("500 karakter sınırını sunucuda uygular", async () => {
    process.env.LANDING_ASSISTANT_AI = "on"
    const response = await POST(request({ question: "a".repeat(501) }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ success: false, errors: { question: "Soru en fazla 500 karakter olabilir" } })
  })

  test("mock sağlayıcıyla kaynaklı yanıt verir", async () => {
    process.env.LANDING_ASSISTANT_AI = "on"
    process.env.AI_PROVIDER = "mock"
    resetAdvisorProvider()
    const body = await (await POST(request({ question: "stok takibi nasıl çalışıyor?" }))).json()
    expect(body.mode).toBe("ai")
    expect(body.sources[0].id).toBe("stok-dusumu")
  })

  test("olmayan özellikte fallback döner", async () => {
    process.env.LANDING_ASSISTANT_AI = "on"
    process.env.AI_PROVIDER = "mock"
    resetAdvisorProvider()
    const body = await (await POST(request({ question: "Muhasebe programına otomatik e-fatura kesiyor musunuz?" }))).json()
    expect(body).toEqual({ success: true, mode: "fallback" })
  })

  test("sağlayıcı hatasında deterministik fallback döner", async () => {
    process.env.LANDING_ASSISTANT_AI = "on"
    process.env.AI_PROVIDER = "gecersiz"
    resetAdvisorProvider()
    const response = await POST(request({ question: "stok takibi" }, "198.51.100.20"))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, mode: "fallback" })
  })

  test("IP hız sınırında 429 yerine deterministik fallback döner", async () => {
    process.env.LANDING_ASSISTANT_AI = "on"
    process.env.AI_PROVIDER = "mock"
    resetAdvisorProvider()
    let body: unknown
    for (let index = 0; index < 11; index++) {
      body = await (await POST(request({ question: "stok takibi" }, "198.51.100.30"))).json()
    }
    expect(body).toEqual({ success: true, mode: "fallback" })
  })

  test("sağlayıcı isteğini süre dolunca iptal eder", async () => {
    const waitsForAbort = (_question: string, signal?: AbortSignal) =>
      new Promise<never>((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))
      })

    await expect(askWithTimeout("stok takibi", 5, waitsForAbort)).rejects.toMatchObject({ name: "AbortError" })
  })
})
