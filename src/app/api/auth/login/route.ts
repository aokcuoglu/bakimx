import { NextResponse } from "next/server"
import { loginSchema } from "@/lib/validations/auth"
import { establishSession } from "@/lib/session"
import {
  verifyCredentials,
  loginRateLimit,
  loginAccountRateLimit,
  resolveWorkshopIdByLoginCode,
  clientIpFromHeaders,
  INVALID_CREDENTIALS_MESSAGE,
  PLAN_EXPIRED_LOGIN_REDIRECT,
  TOO_MANY_ATTEMPTS_MESSAGE,
} from "@/lib/auth-login"
import { isEmailIdentifier } from "@/lib/user-identity"
import { auditBreakGlassLogin } from "@/lib/admin-break-glass"
import { resolveSessionSurface } from "@/lib/sales/session-surface"

function tooManyAttempts(retryAfterMs: number) {
  return NextResponse.json(
    { error: TOO_MANY_ATTEMPTS_MESSAGE },
    { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
  )
}

export async function POST(request: Request) {
  try {
    const ip = clientIpFromHeaders(request.headers)
    const limit = await loginRateLimit(ip)
    if (!limit.allowed) return tooManyAttempts(limit.retryAfterMs)

    const formData = await request.formData()
    // `identifier` yeni alan adı; `email` geriye dönük uyumluluk için korunur
    // (mevcut giriş formu ve entegrasyonlar hâlâ onu gönderiyor).
    const raw = {
      identifier: ((formData.get("identifier") ?? formData.get("email")) as string || "")
        .trim()
        .toLowerCase(),
      workshopCode: ((formData.get("workshopCode") as string) || "").trim().toLowerCase(),
      password: formData.get("password") as string,
    }

    const parsed = loginSchema.safeParse({
      ...raw,
      workshopCode: raw.workshopCode || undefined,
    })
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" },
        { status: 400 }
      )
    }

    // Kullanıcı adı yolunda tenant'ı önce çöz: hesap bazlı limit kovası da,
    // kullanıcı araması da `(workshopId, username)` ikilisine bağlı.
    let workshopId: string | null = null
    if (!isEmailIdentifier(parsed.data.identifier)) {
      workshopId = await resolveWorkshopIdByLoginCode(parsed.data.workshopCode ?? "")
      // Bilinmeyen iş yeri kodu da jenerik hata döner — var olan atölyeleri
      // sayan bir oracle bırakmayalım.
      if (!workshopId) {
        return NextResponse.json({ error: INVALID_CREDENTIALS_MESSAGE }, { status: 400 })
      }
    }

    const accountLimit = await loginAccountRateLimit(parsed.data.identifier, workshopId)
    if (!accountLimit.allowed) return tooManyAttempts(accountLimit.retryAfterMs)

    const result = await verifyCredentials({
      identifier: parsed.data.identifier,
      password: parsed.data.password,
      workshopId,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // Rotate the session on login: clear any pre-existing (possibly fixated)
    // session data before writing the authenticated identity.
    const surface = await resolveSessionSurface(result.userId, result.workshopId)
    await establishSession(result.userId, result.workshopId, result.role, "password", surface)
    await auditBreakGlassLogin({
      identifier: parsed.data.identifier,
      userId: result.userId,
      workshopId: result.workshopId,
    })

    // Planı bitmiş workshop'lar uygulamaya değil satın alma akışına gider; app
    // rotaları onları zaten çıkışa yönlendirir (bkz. (app)/layout.tsx).
    return NextResponse.json({
      success: true,
      redirect: surface === "sales"
        ? "/admin/sales"
        : result.planExpiredReason
          ? PLAN_EXPIRED_LOGIN_REDIRECT
          : null,
      mustChangePassword: result.mustChangePassword,
    })
  } catch (error) {
    console.error("Login handler error:", error)
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}
