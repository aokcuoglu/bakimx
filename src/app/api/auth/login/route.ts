import { NextResponse } from "next/server"
import { loginSchema } from "@/lib/validation"
import { getSession } from "@/lib/session"
import {
  verifyCredentials,
  loginRateLimit,
  clientIpFromHeaders,
  TOO_MANY_ATTEMPTS_MESSAGE,
} from "@/lib/auth-login"

export async function POST(request: Request) {
  try {
    const ip = clientIpFromHeaders(request.headers)
    const limit = loginRateLimit(ip)
    if (!limit.allowed) {
      return NextResponse.json(
        { error: TOO_MANY_ATTEMPTS_MESSAGE },
        { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } }
      )
    }

    const formData = await request.formData()
    const raw = {
      email: (formData.get("email") as string || "").trim().toLowerCase(),
      password: formData.get("password") as string,
    }

    const parsed = loginSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" },
        { status: 400 }
      )
    }

    const result = await verifyCredentials(parsed.data.email, parsed.data.password)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // Rotate the session on login: clear any pre-existing (possibly fixated)
    // session data before writing the authenticated identity.
    const session = await getSession()
    session.destroy()
    session.userId = result.userId
    session.workshopId = result.workshopId
    await session.save()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Login handler error:", error)
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}
