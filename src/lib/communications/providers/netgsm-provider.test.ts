import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { NETGSM_MAX_MESSAGE_LENGTH, NetgsmProvider, netgsmErrorMessage, toNetgsmNumber } from "./netgsm-provider"

const realFetch = globalThis.fetch
const env = { ...process.env }

type Call = { url: string; init: RequestInit }
let calls: Call[] = []

function stubFetch(impl: () => Response | Promise<Response>) {
  calls = []
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    return impl()
  }) as typeof fetch
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

beforeEach(() => {
  process.env.NETGSM_USERCODE = "8501234567"
  process.env.NETGSM_PASSWORD = "s3cret-pass"
  delete process.env.NETGSM_API_URL
  delete process.env.NETGSM_SENDER
})

afterEach(() => {
  globalThis.fetch = realFetch
  process.env = { ...env }
})

describe("NetgsmProvider", () => {
  test("yapılandırma yoksa kurucu hata fırlatır", () => {
    delete process.env.NETGSM_PASSWORD
    expect(() => new NetgsmProvider()).toThrow()
  })

  test("başarı: REST v2, Basic auth, JSON gövde, jobid → providerId", async () => {
    stubFetch(() => json({ code: "00", jobid: "12345", description: "queued" }))
    const result = await new NetgsmProvider().sendSMS("+90 532 111-22-33", "Merhaba")
    expect(result).toEqual({ success: true, providerId: "12345" })

    const { url, init } = calls[0]
    expect(url).toBe("https://api.netgsm.com.tr/sms/rest/v2/send")
    expect(url).not.toContain("s3cret-pass")
    expect(url).not.toContain("?")
    expect(init.method).toBe("POST")
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe(`Basic ${Buffer.from("8501234567:s3cret-pass").toString("base64")}`)
    expect(JSON.parse(String(init.body))).toEqual({
      msgheader: "BAKIMX",
      encoding: "TR",
      iysfilter: "0",
      messages: [{ msg: "Merhaba", no: "5321112233" }],
    })
    expect(init.signal).toBeDefined()
  })

  test("NETGSM_API_URL ve NETGSM_SENDER geçersiz kılınabilir", async () => {
    process.env.NETGSM_API_URL = "https://example.test/send"
    process.env.NETGSM_SENDER = "ATOLYE"
    stubFetch(() => json({ code: "00", jobid: 1 }))
    await new NetgsmProvider().sendSMS("5321112233", "x")
    expect(calls[0].url).toBe("https://example.test/send")
    expect(JSON.parse(String(calls[0].init.body)).msgheader).toBe("ATOLYE")
  })

  for (const code of ["20", "30", "40", "50", "51", "70", "80", "85"]) {
    test(`hata kodu ${code} sızıntısız Türkçe mesaja eşlenir`, async () => {
      stubFetch(() => json({ code, description: "raw 5321112233 s3cret-pass Gizli metin" }))
      const result = await new NetgsmProvider().sendSMS("5321112233", "Gizli metin")
      expect(result.success).toBe(false)
      expect(result.error).toBe(netgsmErrorMessage(code))
      expect(result.error).toContain(`kod ${code}`)
      expect(result.error).not.toContain("5321112233")
      expect(result.error).not.toContain("s3cret-pass")
      expect(result.error).not.toContain("Gizli metin")
    })
  }

  test("bilinmeyen kod yalnız kodu içerir", async () => {
    stubFetch(() => json({ code: "99", description: "boom 5321112233" }))
    const result = await new NetgsmProvider().sendSMS("5321112233", "x")
    expect(result).toEqual({ success: false, error: "Netgsm: SMS gönderilemedi (kod 99)" })
  })

  test("JSON olmayan 2xx yanıt", async () => {
    stubFetch(() => new Response("<html>5321112233</html>", { status: 200 }))
    const result = await new NetgsmProvider().sendSMS("5321112233", "x")
    expect(result.success).toBe(false)
    expect(result.error).not.toContain("5321112233")
  })

  test("JSON olmayan 5xx yanıt", async () => {
    stubFetch(() => new Response("oops", { status: 502 }))
    const result = await new NetgsmProvider().sendSMS("5321112233", "x")
    expect(result).toEqual({ success: false, error: "Netgsm: sunucu hatası (HTTP 502)" })
  })

  test("zaman aşımı sızıntısız hata döner", async () => {
    stubFetch(() => {
      throw new DOMException("The operation timed out. s3cret-pass", "TimeoutError")
    })
    const result = await new NetgsmProvider().sendSMS("5321112233", "x")
    expect(result).toEqual({ success: false, error: "Netgsm: istek zaman aşımına uğradı" })
  })

  test("gövde okunurken zaman aşımı da zaman aşımı sayılır", async () => {
    stubFetch(() => {
      const response = new Response("{}", { status: 200 })
      response.json = () => Promise.reject(new DOMException("timed out", "TimeoutError"))
      return response
    })
    const result = await new NetgsmProvider().sendSMS("5321112233", "x")
    expect(result).toEqual({ success: false, error: "Netgsm: istek zaman aşımına uğradı" })
  })

  test("ağ hatası ham mesajı taşımaz", async () => {
    stubFetch(() => {
      throw new Error("connect ECONNREFUSED s3cret-pass")
    })
    const result = await new NetgsmProvider().sendSMS("5321112233", "x")
    expect(result.error).toBe("Netgsm: SMS servisine ulaşılamadı")
  })

  test("geçersiz numara istek atılmadan reddedilir", async () => {
    stubFetch(() => json({ code: "00", jobid: 1 }))
    for (const bad of ["", "abc", "1234567", "02121112233", "+1 555 111 2233"]) {
      const result = await new NetgsmProvider().sendSMS(bad, "x")
      expect(result.success).toBe(false)
    }
    expect(calls).toHaveLength(0)
  })

  test("çok uzun veya boş mesaj kırpılmadan reddedilir", async () => {
    stubFetch(() => json({ code: "00", jobid: 1 }))
    const provider = new NetgsmProvider()
    expect((await provider.sendSMS("5321112233", "a".repeat(NETGSM_MAX_MESSAGE_LENGTH + 1))).success).toBe(false)
    expect((await provider.sendSMS("5321112233", "  ")).success).toBe(false)
    expect(calls).toHaveLength(0)
    expect((await provider.sendSMS("5321112233", "a".repeat(NETGSM_MAX_MESSAGE_LENGTH))).success).toBe(true)
  })
})

describe("toNetgsmNumber", () => {
  test("biçimleri 10 haneli 5xxxxxxxxx'e çevirir", () => {
    for (const input of ["+90 532 111 22 33", "905321112233", "05321112233", "5321112233", "0 (532) 111-22-33"]) {
      expect(toNetgsmNumber(input)).toBe("5321112233")
    }
  })

  test("geçersizi null döner", () => {
    expect(toNetgsmNumber("")).toBeNull()
    expect(toNetgsmNumber("4321112233")).toBeNull()
    expect(toNetgsmNumber("532111223")).toBeNull()
  })
})
