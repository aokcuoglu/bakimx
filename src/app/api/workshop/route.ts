import { updateBusinessProfileAction } from "@/app/(app)/settings/actions"
import { rateLimit } from "@/lib/rate-limit"
import { NextResponse } from "next/server"

export async function PUT(request: Request) {
  const clientId = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
  const { allowed, retryAfterMs } = rateLimit(`settings-profile:${clientId}`)
  if (!allowed) {
    return NextResponse.json(
      { error: "Çok fazla istek. Lütfen bekleyin." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    )
  }

  try {
    const body = await request.json()
    const formData = new FormData()
    for (const [key, value] of Object.entries(body)) {
      formData.set(key, String(value ?? ""))
    }
    const result = await updateBusinessProfileAction(formData)
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}