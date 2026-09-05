import { NextResponse } from "next/server"
import { getOcrProvider } from "@/lib/ocr/provider"
import { DEMO_BROWSER_SECONDS, DemoQuotaError, demoQuotaKeys, demoQuotaStatus, reserveDemoQuota, refundDemoQuota } from "@/lib/ocr/demo-quota"
import { DEMO_COOKIE, demoConfig, demoClientIp, signDemoCookie, readDemoCookie, sameDemoOrigin, verifyDemoBot, readDemoForm, normalizeDemoImage, publicDemoFields, DemoImageError } from "@/lib/ocr/demo-server"
import type { DemoOcrResponse, DemoOcrStatus } from "@/lib/ocr/demo-contract"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const UNAVAILABLE = "Ruhsat denemesi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin."
function json(body: DemoOcrResponse | DemoOcrStatus, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" } })
}
function failure(code: Extract<DemoOcrResponse, { success: false }>["code"], error: string, status: number, retryAfterSeconds?: number) {
  const response = json({ success: false, code, error, ...(retryAfterSeconds ? { retryAfterSeconds } : {}) }, status)
  if (retryAfterSeconds) response.headers.set("Retry-After", String(retryAfterSeconds))
  return response
}
export async function GET(request: Request) {
  const config = demoConfig(request)
  const ip = demoClientIp(request)
  if (!config || !ip) return json({ status: "unavailable", message: UNAVAILABLE })
  const existing = readDemoCookie(request, config.secret)
  const signed = signDemoCookie(config.secret, existing ?? undefined)
  const id = signed.split(".")[0]
  let response: NextResponse
  try {
    await demoQuotaStatus(demoQuotaKeys(id, ip, config.secret), config.globalMax)
    response = json({ status: "ready", siteKey: config.siteKey })
  } catch (error) {
    response = error instanceof DemoQuotaError
      ? json({ status: error.code, message: error.code === "used" ? "Bu tarayıcıda ücretsiz ruhsat denemeniz kullanıldı." : "Bu bağlantının deneme sınırına ulaşıldı. Lütfen daha sonra tekrar deneyin.", retryAfterSeconds: error.retryAfterSeconds })
      : json({ status: "unavailable", message: UNAVAILABLE })
  }
  if (!existing) response.cookies.set(DEMO_COOKIE, signed, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: DEMO_BROWSER_SECONDS })
  return response
}
export async function POST(request: Request) {
  if (!sameDemoOrigin(request)) return failure("invalid_request", "İstek doğrulanamadı. Sayfayı yenileyin.", 403)
  const config = demoConfig(request)
  const ip = demoClientIp(request)
  if (!config || !ip) return failure("unavailable", UNAVAILABLE, 503)
  const id = readDemoCookie(request, config.secret)
  if (!id) return failure("invalid_request", "Denemeyi başlatmak için sayfayı yenileyin ve çerezlere izin verin.", 403)
  try {
    // Cheap fail-closed quota check precedes reading/decompressing an upload.
    const keys = demoQuotaKeys(id, ip, config.secret)
    await demoQuotaStatus(keys, config.globalMax)
    const form = await readDemoForm(request)
    if (form.get("consent") !== "true") return failure("invalid_request", "Belgenin işlenmesine izin vermelisiniz.", 400)
    const token = form.get("turnstileToken")
    if (typeof token !== "string" || !await verifyDemoBot(token, request, ip, config)) return failure("verification_failed", "Güvenlik doğrulaması tamamlanamadı. Lütfen tekrar deneyin.", 403)
    const image = await normalizeDemoImage(form.get("image"))
    const provider = await getOcrProvider()
    if (provider.name === "mock") return failure("unavailable", UNAVAILABLE, 503)
    const reservation = await reserveDemoQuota(keys, config.globalMax)
    try {
      // Await actual cancellation: never refund while a background OCR call can still run.
      const result = await provider.extractRegistration(image, "image/jpeg", { signal: AbortSignal.timeout(60_000), timeoutMs: 60_000, maxRetries: 0 })
      const fields = publicDemoFields(result)
      if (!fields.length) throw new Error("empty extraction")
      return json({ success: true, fields })
    } catch {
      await refundDemoQuota(reservation)
      return failure("ocr_failed", "Belge okunamadı. Daha net bir fotoğrafla tekrar deneyebilirsiniz.", 422)
    }
  } catch (error) {
    if (error instanceof DemoQuotaError) return failure(error.code, error.code === "used" ? "Bu tarayıcıda ücretsiz ruhsat denemeniz kullanıldı." : "Deneme sınırına ulaşıldı. Lütfen daha sonra tekrar deneyin.", 429, error.retryAfterSeconds)
    if (error instanceof DemoImageError) return failure("invalid_image", "En fazla 8 MB boyutunda, geçerli bir JPEG, PNG veya WebP fotoğraf yükleyin.", 400)
    return failure("unavailable", UNAVAILABLE, 503)
  }
}
