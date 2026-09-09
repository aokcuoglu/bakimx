import { afterEach, beforeEach, describe, expect, test, mock } from "bun:test"
import { isMockWhatsAppOtp, sendWhatsAppOtp } from "./otp"

const keys = ["WHATSAPP_PROVIDER", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_OTP_TEMPLATE_NAME", "WHATSAPP_OTP_TEMPLATE_LANGUAGE", "WHATSAPP_API_URL"] as const
let saved: Record<string, string | undefined>
let originalFetch: typeof fetch
let fetchSpy: ReturnType<typeof mock<typeof fetch>>
beforeEach(() => {
  saved = Object.fromEntries(keys.map(k => [k, process.env[k]]))
  keys.forEach(k => delete process.env[k])
  process.env.WHATSAPP_PROVIDER = "business"
  process.env.WHATSAPP_PHONE_NUMBER_ID = "1234"
  process.env.WHATSAPP_ACCESS_TOKEN = "test-secret"
  process.env.WHATSAPP_OTP_TEMPLATE_NAME = "bakimx_teslim_otp"
  originalFetch = globalThis.fetch
  fetchSpy = mock<typeof fetch>(async () => new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] })))
  globalThis.fetch = fetchSpy
})
afterEach(() => {
  globalThis.fetch = originalFetch
  for (const k of keys) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})
describe("WhatsApp teslim OTP", () => {
  for (const phone of ["0542 368 14 38", "+905423681438", "5423681438"]) {
    test(`authentication template uses normalized recipient ${phone}`, async () => {
      expect(await sendWhatsAppOtp(phone, "123456")).toEqual({ success: true, providerId: "wamid.test" })
      const [url, options] = fetchSpy.mock.calls[0]
      expect(url).toBe("https://graph.facebook.com/v25.0/1234/messages")
      const body = JSON.parse(options?.body as string)
      expect(body.to).toBe("905423681438")
      expect(body.type).toBe("template")
      expect(body.template).toEqual({ name: "bakimx_teslim_otp", language: { code: "tr" }, components: [
        { type: "body", parameters: [{ type: "text", text: "123456" }] },
        { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: "123456" }] },
      ] })
    })
  }
  test("mock never sends a network message", async () => {
    process.env.WHATSAPP_PROVIDER = "mock"
    expect(isMockWhatsAppOtp()).toBe(true)
    expect((await sendWhatsAppOtp("5423681438", "123456")).success).toBe(true)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
  test("unknown provider fails closed", async () => {
    process.env.WHATSAPP_PROVIDER = "buisness"
    expect(isMockWhatsAppOtp()).toBe(false)
    expect((await sendWhatsAppOtp("5423681438", "123456")).success).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
  test("missing template fails before sending", async () => {
    delete process.env.WHATSAPP_OTP_TEMPLATE_NAME
    expect((await sendWhatsAppOtp("5423681438", "123456")).success).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
  test("invalid recipient/code never sends", async () => {
    expect((await sendWhatsAppOtp("invalid", "123456")).success).toBe(false)
    expect((await sendWhatsAppOtp("5423681438", "123")).success).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
  test("provider rejection doesn't leak response contents", async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ error: "123456 test-secret" }), { status: 400 }))
    const result = await sendWhatsAppOtp("5423681438", "123456")
    expect(result.success).toBe(false)
    expect(JSON.stringify(result)).not.toContain("123456")
    expect(JSON.stringify(result)).not.toContain("test-secret")
  })
  test("network exceptions fail without leaking exception text", async () => {
    fetchSpy.mockRejectedValue(new Error("123456 test-secret"))
    expect(await sendWhatsAppOtp("5423681438", "123456")).toEqual({ success: false, error: "WhatsApp OTP gönderilemedi" })
  })
  test("success without a message id fails closed", async () => {
    fetchSpy.mockResolvedValue(new Response("{}"))
    expect((await sendWhatsAppOtp("5423681438", "123456")).success).toBe(false)
  })
})
