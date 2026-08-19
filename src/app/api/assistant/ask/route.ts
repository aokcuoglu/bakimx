import { NextResponse } from "next/server"
import { z } from "zod"
import { askLandingAssistant, LANDING_ASSISTANT_TIMEOUT_MS } from "@/lib/landing/assistant-ai"
import { rateLimit } from "@/lib/rate-limit"

const requestSchema = z.object({
  question: z.string().trim().min(1, "Sorunuzu yazın").max(500, "Soru en fazla 500 karakter olabilir"),
})

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown"
}

const fallback = () => NextResponse.json({ success: true, mode: "fallback" as const })

export async function askWithTimeout(
  question: string,
  timeoutMs: number = LANDING_ASSISTANT_TIMEOUT_MS,
  ask: typeof askLandingAssistant = askLandingAssistant,
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await ask(question, controller.signal)
  } finally {
    clearTimeout(timeout)
  }
}

export async function POST(request: Request) {
  if (process.env.LANDING_ASSISTANT_AI !== "on") return fallback()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, errors: { _general: "Geçersiz istek formatı" } }, { status: 400 })
  }

  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, errors: { question: parsed.error.issues[0]?.message ?? "Geçersiz soru" } },
      { status: 400 },
    )
  }

  // Süreç-içi limiter çok instance arasında koordineli değildir; yatay
  // ölçeklemede ortak Redis/Postgres deposuna taşınmalıdır.
  if (!(await rateLimit(`landing-assistant:${clientIp(request)}`, 10, 60_000)).allowed) return fallback()

  try {
    const result = await askWithTimeout(parsed.data.question)
    return result
      ? NextResponse.json({ success: true, mode: "ai" as const, ...result })
      : fallback()
  } catch (error) {
    console.error("[landing-assistant] provider failure", error instanceof Error ? error.message : error)
    return fallback()
  }
}
