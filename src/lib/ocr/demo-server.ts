import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"
import { isIP } from "node:net"
import sharp from "sharp"
import { DEMO_OCR_MAX_IMAGE_BYTES, DEMO_OCR_IMAGE_TYPES, type DemoOcrField } from "./demo-contract"
import type { RegistrationOcrResult } from "./types"

export const DEMO_COOKIE = "bakimx_demo_ocr"
export const TEST_SITE_KEY = "1x00000000000000000000AA"
export const TEST_SECRET_KEY = "1x0000000000000000000000000000000AA"
export function isLocalDemo(request: Request) {
  return process.env.NODE_ENV === "development" && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname)
}
export function demoExpectedOrigin(request: Request): URL | null {
  if (isLocalDemo(request)) return new URL(new URL(request.url).origin)
  try {
    const configured = process.env.DEMO_OCR_ORIGIN
    if (!configured) return null
    const origin = new URL(configured)
    if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash || request.headers.get("host") !== origin.host) return null
    return origin
  } catch { return null }
}
export function demoConfig(request: Request) {
  const local = isLocalDemo(request)
  if (!demoExpectedOrigin(request)) return null
  const useLocalTestKeys = local && !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !process.env.TURNSTILE_SECRET_KEY
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || (useLocalTestKeys ? TEST_SITE_KEY : undefined)
  const botSecret = process.env.TURNSTILE_SECRET_KEY || (useLocalTestKeys ? TEST_SECRET_KEY : undefined)
  const secret = process.env.SESSION_SECRET
  const provider = process.env.OCR_PROVIDER?.trim().toLowerCase()
  const testKeys = siteKey === TEST_SITE_KEY && botSecret === TEST_SECRET_KEY
  const dummyKey = /^(1|2|3)x0{10}/.test(siteKey ?? "") || /^(1|2|3)x0{10}/.test(botSecret ?? "")
  const globalMax = Number(process.env.DEMO_OCR_DAILY_LIMIT ?? 50)
  if ((!local && (process.env.DEMO_OCR_ENABLED !== "true" || process.env.DEMO_OCR_TRUST_PROXY !== "alb")) || process.env.DEMO_OCR_ENABLED === "false" || !secret || secret.length < 32 || !siteKey || !botSecret || !process.env.DATABASE_URL || !Number.isInteger(globalMax) || globalMax < 1 || globalMax > 1000 || (dummyKey && !(local && testKeys))) return null
  if (!(provider === "anthropic" && process.env.ANTHROPIC_API_KEY) && !(provider === "openai" && process.env.OPENAI_API_KEY && (process.env.OCR_MODEL || process.env.OPENAI_OCR_MODEL))) return null
  return { secret, siteKey, botSecret, testKeys, globalMax }
}
export function signDemoCookie(secret: string, id: string = randomUUID()) {
  const signature = createHmac("sha256", secret).update(`demo-ocr-cookie:${id}`).digest("hex")
  return `${id}.${signature}`
}
export function readDemoCookie(request: Request, secret: string) {
  const value = request.headers.get("cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(`${DEMO_COOKIE}=`))?.slice(DEMO_COOKIE.length + 1)
  if (!value || !/^[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(value)) return null
  const id = value.split(".")[0]
  return timingSafeEqual(Buffer.from(value), Buffer.from(signDemoCookie(secret, id))) ? id : null
}
export function demoClientIp(request: Request) {
  // ECS tasks must only accept traffic from the ALB. ALB appends the actual client;
  // preceding XFF entries are user-controlled, and must never be selected.
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim()
  if (!forwarded) return isLocalDemo(request) ? "127.0.0.1" : null
  let candidate = forwarded
  if (/^\[[0-9a-f:]+\]:\d+$/i.test(candidate)) candidate = candidate.slice(1, candidate.indexOf("]"))
  else if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(candidate)) candidate = candidate.split(":")[0]
  if (isIP(candidate) === 6) return new URL(`http://[${candidate}]`).hostname.slice(1, -1)
  return isIP(candidate) === 4 ? candidate : null
}
export function sameDemoOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin) return false
  try {
    const expected = demoExpectedOrigin(request)
    return expected !== null && origin === expected.origin && !["cross-site", "none"].includes(request.headers.get("sec-fetch-site") ?? "")
  } catch { return false }
}
export async function verifyDemoBot(token: string, request: Request, ip: string, config: NonNullable<ReturnType<typeof demoConfig>>, fetcher: typeof fetch = fetch) {
  if (!token || token.length > 2048) return false
  try {
    const result = await fetcher("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: config.botSecret, response: token, remoteip: ip }), signal: AbortSignal.timeout(8000),
    })
    if (!result.ok) return false
    const data = await result.json()
    if (data.success !== true) return false
    if (config.testKeys && config.siteKey === TEST_SITE_KEY && config.botSecret === TEST_SECRET_KEY && isLocalDemo(request)) {
      return (data.hostname === "localhost" && data.action === "test") ||
        (data.hostname === "example.com" && data.action === undefined && data.metadata?.result_with_testing_key === true)
    }
    const expected = demoExpectedOrigin(request)
    return expected !== null && data.hostname === expected.hostname && data.action === "demo_ocr"
  } catch { return false }
}
export class DemoImageError extends Error {}
export async function readDemoForm(request: Request) {
  const limit = 9 * 1024 * 1024
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;") || Number(request.headers.get("content-length")) > limit || !request.body) throw new DemoImageError()
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let timedOut = false
  const deadline = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => {}) }, 20_000)
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (timedOut) throw new DemoImageError()
      if (done) break
      size += value.byteLength
      if (size > limit) { await reader.cancel(); throw new DemoImageError() }
      chunks.push(value)
    }
    const form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type")! } }).formData()
    return form
  } catch { throw new DemoImageError() } finally { clearTimeout(deadline); reader.releaseLock() }
}
export async function normalizeDemoImage(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0 || file.size > DEMO_OCR_MAX_IMAGE_BYTES || !DEMO_OCR_IMAGE_TYPES.includes(file.type as typeof DEMO_OCR_IMAGE_TYPES[number])) throw new DemoImageError()
  try {
    const bytes = Buffer.from(await file.arrayBuffer())
    const image = sharp(bytes, { limitInputPixels: 25_000_000, failOn: "warning" })
    const meta = await image.metadata()
    if (!meta.format || !["jpeg", "png", "webp"].includes(meta.format) || (meta.pages ?? 1) !== 1 || `image/${meta.format}` !== file.type) throw new DemoImageError()
    return await image.rotate().resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()
  } catch { throw new DemoImageError() }
}
const PUBLIC_FIELDS = [
  ["plate", "Plaka", "A"], ["brand", "Marka", "D.1"], ["model", "Model", "D.3"], ["vin", "Şase no", "E"],
  ["modelYear", "Model yılı", "D.4"], ["vehicleType", "Cinsi", "D.5"], ["engineNo", "Motor numarası", "P.5"],
  ["commercialName", "Ticari adı", "D.3"], ["fuelType", "Yakıt", "P.3"], ["engineDisplacement", "Silindir hacmi", "P.1"],
  ["enginePower", "Motor gücü", "P.2"], ["registrationDate", "Tescil tarihi", "I"], ["inspectionValidUntil", "Muayene geçerlilik tarihi", "Z.2"],
] as const
export function publicDemoFields(result: RegistrationOcrResult): DemoOcrField[] {
  if (result.provider === "mock") return []
  return PUBLIC_FIELDS.flatMap(([key, label, code]) => {
    const field = result[key]
    if (typeof field?.value !== "string" || !field.value.trim()) return []
    return [{ key, label, code, value: field.value.trim().slice(0, 200), ...(typeof field.confidence === "number" && Number.isFinite(field.confidence) ? { confidence: Math.min(1, Math.max(0, field.confidence)) } : {}) }]
  })
}
