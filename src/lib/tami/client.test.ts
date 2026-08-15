import { afterEach, beforeEach, expect, test } from "bun:test"
import { createTamiClient } from "./client"
import { verifyCallbackHash } from "./hash"
import { createMockTamiClient, MOCK_SECRET_KEY } from "./mock"
import { buildTamiPaymentBody } from "./request-builder"
import { sanitizeForLog } from "./errors"
import { TamiError } from "./errors"
import type { TamiConfig } from "./config"
import type { TamiCallbackHashFields } from "./types"

const cfg: TamiConfig = {
  env: "sandbox",
  baseUrl: "https://sandbox-paymentapi.tami.com.tr",
  merchantNumber: "77006950",
  terminalNumber: "84006953",
  secretKey: "0edad05a-7ea7-40f1-a80c-d600121ca51b",
  jwkKid: "test-kid-1",
  jwkKey: "uTFK37C1qQddme6Qjyd1KkcrvdJbHfSAHG9m1zmDhSc",
}

// buildTamiPaymentBody'den üretilir (Task 1 wire şeması) — elle şekillendirilmiş bir
// istek gövdesi DEĞİL, böylece bu test dosyası gerçek şemayla senkron kalır.
/**
 * Rastgele üretilen korelasyon UUID'lerini sabitler.
 *
 * CVV üç karakterdir ("423"); log çıktısının TAMAMINDA alt-dize olarak aranınca
 * `correlationId` UUID'sinin içinde tesadüfen geçebiliyor ve test sahte kırılıyor.
 * Bu, 2026-08-07 prod sürüm kapısını düşürdü. Kontrolün gücü korunmalı, ama
 * karşılaştırma testin konusu OLMAYAN rastgele veriye takılmamalı: UUID'leri
 * maskeleyip asıl yükte tam alt-dize aramasına devam ediyoruz.
 */
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
function withoutRandomIds(value: string): string {
  return value.replace(UUID_RE, "<correlation-id>")
}

const sampleInput = buildTamiPaymentBody({
  orderId: "ORDER-CLIENT-TEST-1",
  amountMinor: 19990,
  callbackUrl: "https://app.bakimx.com/api/tami/callback",
  card: {
    number: "5406697543211173",
    holderName: "Test Kullanıcı",
    expireMonth: 4,
    expireYear: 2027,
    cvv: "423",
  },
  contact: {
    name: "Test",
    surName: "Kullanıcı",
    email: "test@bakimx.com",
    phone: "+905551234567",
    ip: "127.0.0.1",
  },
  basketItemName: "Test Ürün",
})

let originalFetch: typeof globalThis.fetch

beforeEach(() => {
  originalFetch = globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

test("auth3ds: PG-Auth-Token ve CorrelationId header'larını gönderir, her istekte CorrelationId benzersizdir", async () => {
  const seenCorrelationIds: string[] = []
  const seenHeaders: Record<string, string>[] = []

  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    const headers = init?.headers as Record<string, string>
    seenHeaders.push(headers)
    seenCorrelationIds.push(headers.CorrelationId)
    return new Response(
      JSON.stringify({
        success: true,
        systemTime: "2026-07-06T12:00:00Z",
        correlationId: headers.CorrelationId,
        orderId: "ORDER-CLIENT-TEST-1",
        threeDSHtmlContent: "PGh0bWw+PC9odG1sPg==",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  }) as typeof fetch

  const client = createTamiClient(cfg)
  await client.auth3ds(sampleInput)
  await client.auth3ds({ ...sampleInput, orderId: "ORDER-CLIENT-TEST-2" })

  expect(seenHeaders[0]["PG-Auth-Token"]).toBe(
    "77006950:84006953:Y1b81CLYkxvCvw/LhNwS+5c+cSgVGBH2bcAEg1Ik93Y="
  )
  expect(seenHeaders[0]["Content-Type"]).toBe("application/json")
  expect(seenCorrelationIds[0]).toBeTruthy()
  expect(seenCorrelationIds[1]).toBeTruthy()
  expect(seenCorrelationIds[0]).not.toBe(seenCorrelationIds[1])
})

test("auth3ds: gönderilen body'de securityHash alanı vardır ve boş değildir", async () => {
  let sentBody: Record<string, unknown> | undefined

  globalThis.fetch = (async (_url: string, init?: RequestInit) => {
    sentBody = JSON.parse(init?.body as string)
    return new Response(
      JSON.stringify({ success: true, systemTime: "2026-07-06T12:00:00Z", correlationId: "c1", orderId: sampleInput.orderId }),
      { status: 200 }
    )
  }) as typeof fetch

  const client = createTamiClient(cfg)
  await client.auth3ds(sampleInput)

  expect(typeof sentBody?.securityHash).toBe("string")
  expect((sentBody?.securityHash as string).length).toBeGreaterThan(0)
  // JWS compact format: header.payload.signature
  expect((sentBody?.securityHash as string).split(".").length).toBe(3)
})

test("preAuth3ds: /payment/pre-auth'a POST eder (auth3ds ile aynı gövde, farklı endpoint)", async () => {
  let path = ""
  let sentBody: Record<string, unknown> | undefined
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    path = new URL(url).pathname
    sentBody = JSON.parse(init?.body as string)
    return new Response(
      JSON.stringify({
        success: true,
        systemTime: "2026-07-07T12:00:00Z",
        correlationId: "c1",
        orderId: sampleInput.orderId,
        threeDSHtmlContent: "PGh0bWw+PC9odG1sPg==",
      }),
      { status: 200 }
    )
  }) as typeof fetch

  const client = createTamiClient(cfg)
  await client.preAuth3ds(sampleInput)

  expect(path).toBe("/payment/pre-auth")
  expect(typeof sentBody?.securityHash).toBe("string")
})

test("auth3ds: TAMI hata yanıtı (errorCode) → TamiError fırlatır, userMessage haritadan gelir", async () => {
  globalThis.fetch = (async () => {
    return new Response(
      JSON.stringify({
        success: false,
        systemTime: "2026-07-06T12:00:00Z",
        correlationId: "err-corr-1",
        errorCode: "30002",
        errorMessage: "Kart geçersiz",
      }),
      { status: 200 }
    )
  }) as typeof fetch

  const client = createTamiClient(cfg)

  await expect(client.auth3ds(sampleInput)).rejects.toThrow(TamiError)

  try {
    await client.auth3ds(sampleInput)
    throw new Error("beklenen hata fırlatılmadı")
  } catch (err) {
    expect(err).toBeInstanceOf(TamiError)
    const tamiErr = err as TamiError
    expect(tamiErr.code).toBe("30002")
    expect(tamiErr.correlationId).toBe("err-corr-1")
    expect(tamiErr.userMessage).toBe("Kart geçersiz. Farklı bir kart ile yeniden deneyin.")
  }
})

test("auth3ds: TAMI errorCode'u SAYI dönerse code STRING'e normalize edilir (Prisma String? kolonuna güvenli yazım)", async () => {
  // Gerçek TAMI /payment/complete-3ds yanıtı errorCode'u JSON SAYI olarak dönebiliyor (148).
  // Bu sayı Prisma'nın String? errorCode kolonuna doğrudan yazılırsa update FIRLATIR ve
  // .catch(()=>{}) onu yutup txn'i callback_received'da takılı bırakır (canlı prod bug'ı).
  // TamiError.code her zaman string olmalı.
  globalThis.fetch = (async () => {
    return new Response(
      JSON.stringify({
        success: false,
        systemTime: "2026-07-08T22:57:57Z",
        correlationId: "err-corr-num",
        errorCode: 148,
        errorMessage: "Kart bilgileri hatalı. TAMI-148",
      }),
      { status: 200 }
    )
  }) as typeof fetch

  const client = createTamiClient(cfg)
  try {
    await client.complete3ds("ORDER-NUM-CODE")
    throw new Error("beklenen hata fırlatılmadı")
  } catch (err) {
    expect(err).toBeInstanceOf(TamiError)
    const tamiErr = err as TamiError
    expect(typeof tamiErr.code).toBe("string")
    expect(tamiErr.code).toBe("148")
  }
})

test("auth3ds: fetch reddedilirse (ağ hatası) → TamiError fırlatır, hata loglama çağrısı card alanını sızdırmaz", async () => {
  const errorLogs: unknown[] = []
  const originalConsoleError = console.error
  console.error = (...args: unknown[]) => {
    errorLogs.push(args)
  }

  globalThis.fetch = (async () => {
    throw new Error("network down")
  }) as typeof fetch

  try {
    const client = createTamiClient(cfg)
    await expect(client.auth3ds(sampleInput)).rejects.toThrow(TamiError)
  } finally {
    console.error = originalConsoleError
  }

  const serialized = withoutRandomIds(JSON.stringify(errorLogs))
  expect(serialized).not.toContain(sampleInput.card.number)
  expect(serialized).not.toContain(sampleInput.card.cvv)
  expect(serialized).toContain("[redacted]")

  // KRİTİK: securityHash bir HS512 JWS'tir — imzalı ama ŞİFRESİZ. Orta segmenti base64url
  // decode edilirse kart verisi dahil tüm gövde geri okunur. Bu yüzden düz-metin PAN kontrolü
  // yetmez: log çıktısındaki HER JWS-benzeri string'in payload'unu decode edip PAN/CVV'nin
  // GERİ KAZANILAMADIĞINI da doğrula (securityHash redaksiyonu bozulursa bu test kırılır).
  const jwsCandidates = serialized.match(/[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g) ?? []
  for (const jws of jwsCandidates) {
    const middle = jws.split(".")[1]
    const decodedPayload = Buffer.from(middle, "base64url").toString("utf8")
    expect(decodedPayload).not.toContain(sampleInput.card.number)
    expect(decodedPayload).not.toContain(sampleInput.card.cvv)
    expect(decodedPayload).not.toContain(sampleInput.card.holderName)
  }
  // Ayrıca loglanan body nesnesinde securityHash'in redakte edildiğini doğrudan doğrula.
  const loggedBody = (errorLogs[0] as unknown[])?.[1] as { body?: Record<string, unknown> } | undefined
  expect(loggedBody?.body?.securityHash).toBe("[redacted]")
})

test("TamiError: hata nesnesi istek gövdesini/kart verisini taşımaz (serialize edilirse sızıntı olmaz)", async () => {
  globalThis.fetch = (async () => {
    throw new Error("network down")
  }) as typeof fetch

  const client = createTamiClient(cfg)
  let caught: unknown
  try {
    await client.auth3ds(sampleInput)
  } catch (err) {
    caught = err
  }

  expect(caught).toBeInstanceOf(TamiError)
  const tamiErr = caught as TamiError
  const serializedErr = withoutRandomIds(
    JSON.stringify({
      ...tamiErr,
      message: tamiErr.message,
      stack: tamiErr.stack,
    })
  )
  expect(serializedErr).not.toContain(sampleInput.card.number)
  expect(serializedErr).not.toContain(sampleInput.card.cvv)
  // JWS-benzeri string'ler TamiError üzerinden de sızmamalı
  const jwsInError = serializedErr.match(/[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g) ?? []
  for (const jws of jwsInError) {
    const decodedPayload = Buffer.from(jws.split(".")[1], "base64url").toString("utf8")
    expect(decodedPayload).not.toContain(sampleInput.card.number)
    expect(decodedPayload).not.toContain(sampleInput.card.cvv)
  }
})

test("auth3ds: JSON parse edilemeyen yanıt → TamiError fırlatır", async () => {
  globalThis.fetch = (async () => {
    return new Response("<html>not json</html>", { status: 200 })
  }) as typeof fetch

  const client = createTamiClient(cfg)
  await expect(client.auth3ds(sampleInput)).rejects.toThrow(TamiError)
})

test("sanitizeForLog: card VE securityHash alanlarını [redacted] yapar, diğer alanları korur, orijinal nesneyi mutasyona uğratmaz", () => {
  const body = {
    orderId: "X",
    card: { number: "4111111111111111", cvv: "123" },
    amount: 10,
    securityHash: "eyJhbGciOiJIUzUxMiJ9.eyJzZWNyZXQiOiJib2R5In0.sig",
  }
  const sanitized = sanitizeForLog(body) as Record<string, unknown>

  expect(sanitized.card).toBe("[redacted]")
  expect(sanitized.securityHash).toBe("[redacted]")
  expect(sanitized.orderId).toBe("X")
  expect(sanitized.amount).toBe(10)
  // orijinal nesne değişmemiş olmalı (kopya üzerinde çalışıldı)
  expect((body.card as { number: string }).number).toBe("4111111111111111")
  expect(body.securityHash).toBe("eyJhbGciOiJIUzUxMiJ9.eyJzZWNyZXQiOiJib2R5In0.sig")
})

test("cancel/refund: ikisi de /payment/reverse'e POST eder, refund amount taşır cancel taşımaz", async () => {
  const calls: { path: string; body: Record<string, unknown> }[] = []

  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ path: new URL(url).pathname, body: JSON.parse(init?.body as string) })
    return new Response(
      JSON.stringify({ success: true, orderId: "O1", systemTime: "t", correlationId: "c1" }),
      { status: 200 }
    )
  }) as typeof fetch

  const client = createTamiClient(cfg)
  await client.cancel({ orderId: "O1" })
  await client.refund({ orderId: "O1", amount: 50 })

  expect(calls[0].path).toBe("/payment/reverse")
  expect(calls[0].body.amount).toBeUndefined()
  expect(calls[1].path).toBe("/payment/reverse")
  expect(calls[1].body.amount).toBe(50)
})

test("queryTransaction: /payment/query'e POST eder", async () => {
  let path = ""
  globalThis.fetch = (async (url: string) => {
    path = new URL(url).pathname
    return new Response(
      JSON.stringify({ success: true, systemTime: "t", orderId: "O1", orderStatus: "AUTH", paymentStatus: "SUCCESS" }),
      { status: 200 }
    )
  }) as typeof fetch

  const client = createTamiClient(cfg)
  const result = await client.queryTransaction({ orderId: "O1" })

  expect(path).toBe("/payment/query")
  expect(result.orderStatus).toBe("AUTH")
})

// --- Mock istemci: auth3ds → base64 3DS HTML, formların hashedData'sı doğrulanabilir ---

function extractForms(html: string): { outcome: string; fields: Record<string, string> }[] {
  const forms: { outcome: string; fields: Record<string, string> }[] = []
  const formRegex = /<form[^>]*data-mock-outcome="([^"]+)"[^>]*>([\s\S]*?)<\/form>/g
  let formMatch: RegExpExecArray | null

  while ((formMatch = formRegex.exec(html)) !== null) {
    const outcome = formMatch[1]
    const body = formMatch[2]
    const fields: Record<string, string> = {}
    const inputRegex = /<input type="hidden" name="([^"]+)" value="([^"]*)">/g
    let inputMatch: RegExpExecArray | null
    while ((inputMatch = inputRegex.exec(body)) !== null) {
      fields[inputMatch[1]] = inputMatch[2]
    }
    forms.push({ outcome, fields })
  }

  return forms
}

test("mock auth3ds: threeDSHtmlContent base64 decode edilebilir ve HTML içerir", async () => {
  const client = createMockTamiClient()
  const result = await client.auth3ds(sampleInput)

  expect(result.success).toBe(true)
  expect(typeof result.threeDSHtmlContent).toBe("string")

  const html = Buffer.from(result.threeDSHtmlContent as string, "base64").toString("utf8")
  expect(html).toContain("<html")
  expect(html).toContain("TAMI Mock 3D Secure")
})

test("mock auth3ds: HTML içindeki her iki formun (başarı/başarısız) hashedData'sı verifyCallbackHash(mock-secret) ile doğrulanır", async () => {
  const client = createMockTamiClient()
  const result = await client.auth3ds(sampleInput)
  const html = Buffer.from(result.threeDSHtmlContent as string, "base64").toString("utf8")

  const forms = extractForms(html)
  expect(forms.length).toBe(2)

  const successForm = forms.find((f) => f.outcome === "success")
  const failureForm = forms.find((f) => f.outcome === "failure")
  expect(successForm).toBeTruthy()
  expect(failureForm).toBeTruthy()

  expect(successForm?.fields.mdStatus).toBe("1")
  expect(successForm?.fields.success).toBe("true")
  expect(failureForm?.fields.mdStatus).toBe("0")
  expect(failureForm?.fields.success).toBe("false")

  for (const form of [successForm, failureForm]) {
    const fields = form?.fields as unknown as TamiCallbackHashFields & { hashedData: string }
    expect(verifyCallbackHash(fields, { secretKey: MOCK_SECRET_KEY })).toBe(true)
    // Yanlış secretKey ile doğrulama başarısız olmalı (sahte-pozitif koruması)
    expect(verifyCallbackHash(fields, { secretKey: "wrong-secret" })).toBe(false)
  }
})

test("mock auth3ds: formlar sipariş/tutar bilgilerini taşır, kart PAN/CVV form alanlarında yer almaz", async () => {
  const client = createMockTamiClient()
  const result = await client.auth3ds(sampleInput)
  const html = Buffer.from(result.threeDSHtmlContent as string, "base64").toString("utf8")
  const forms = extractForms(html)

  for (const form of forms) {
    expect(form.fields.orderId).toBe(sampleInput.orderId)
    expect(form.fields.currencyCode).toBe(sampleInput.currency)
    const fieldValues = Object.values(form.fields)
    expect(fieldValues).not.toContain(sampleInput.card.number)
    expect(fieldValues).not.toContain(sampleInput.card.cvv)
  }
})

test("mock preAuth3ds: auth3ds ile aynı sahte 3DS yanıtını üretir (base64 HTML)", async () => {
  const client = createMockTamiClient()
  const result = await client.preAuth3ds(sampleInput)

  expect(result.success).toBe(true)
  const html = Buffer.from(result.threeDSHtmlContent as string, "base64").toString("utf8")
  expect(html).toContain("TAMI Mock 3D Secure")
})

test("mock complete3ds/cancel/refund/queryTransaction: gerçek HTTP olmadan success döner", async () => {
  const client = createMockTamiClient()

  await expect(client.complete3ds("ORDER-1")).resolves.toMatchObject({ success: true, orderId: "ORDER-1" })
  await expect(client.cancel({ orderId: "ORDER-1" })).resolves.toMatchObject({ success: true, orderId: "ORDER-1" })
  await expect(client.refund({ orderId: "ORDER-1", amount: 25 })).resolves.toMatchObject({
    success: true,
    orderId: "ORDER-1",
    amount: 25,
  })
  await expect(client.queryTransaction({ orderId: "ORDER-1" })).resolves.toMatchObject({
    success: true,
    orderId: "ORDER-1",
  })
})
