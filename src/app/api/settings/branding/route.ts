import { updateBrandingAction } from "@/app/app/settings/actions"
import { rateLimit } from "@/lib/rate-limit"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const clientId = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
  const { allowed, retryAfterMs } = rateLimit(`settings-branding:${clientId}`)
  if (!allowed) {
    return NextResponse.json(
      { error: "Çok fazla istek. Lütfen bekleyin." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    )
  }

  try {
    const formData = await request.formData()
    const result = await updateBrandingAction(formData)
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}