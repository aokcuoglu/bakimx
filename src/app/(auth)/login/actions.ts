"use server"

import { loginSchema } from "@/lib/validations/auth"
import { establishSession, getSession } from "@/lib/session"
import { headers } from "next/headers"
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
import { redirect } from "next/navigation"
import { auditBreakGlassLogin } from "@/lib/admin-break-glass"

// NOTE: self-serve signup (see /register) creates a workshop in `pending` status.
// Pending workshops CAN sign in — they land on the full-screen card-verification
// lock ((app)/layout.tsx) and start their trial once the card is verified. Only
// `rejected` workshops are blocked at login. Accounts may also be provisioned via
// seed / admin.

export async function loginAction(formData: FormData) {
  // `identifier` yeni alan adı; `email` geriye dönük uyumluluk için korunur.
  const workshopCode = ((formData.get("workshopCode") as string) || "").trim().toLowerCase()
  const raw = {
    identifier: ((formData.get("identifier") ?? formData.get("email")) as string || "")
      .trim()
      .toLowerCase(),
    workshopCode: workshopCode || undefined,
    password: formData.get("password") as string,
  }

  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  const ip = clientIpFromHeaders(await headers())
  const limit = await loginRateLimit(ip)
  if (!limit.allowed) {
    return { error: TOO_MANY_ATTEMPTS_MESSAGE }
  }

  // Kullanıcı adı yolu tenant'sız çözülemez; kodu önce iş yerine çevir.
  let workshopId: string | null = null
  if (!isEmailIdentifier(parsed.data.identifier)) {
    workshopId = await resolveWorkshopIdByLoginCode(parsed.data.workshopCode ?? "")
    // Bilinmeyen kod da jenerik hata döner (atölye enumerasyonu yok).
    if (!workshopId) return { error: INVALID_CREDENTIALS_MESSAGE }
  }

  const accountLimit = await loginAccountRateLimit(parsed.data.identifier, workshopId)
  if (!accountLimit.allowed) {
    return { error: TOO_MANY_ATTEMPTS_MESSAGE }
  }

  const result = await verifyCredentials({
    identifier: parsed.data.identifier,
    password: parsed.data.password,
    workshopId,
  })
  if (!result.ok) {
    return { error: result.error }
  }

  // Rotate the session on login (clear any pre-existing data first).
  await establishSession(result.userId, result.workshopId, result.role)
  await auditBreakGlassLogin({
    identifier: parsed.data.identifier,
    userId: result.userId,
    workshopId: result.workshopId,
  })

  // API rotasıyla aynı sözleşme: planı bitmişse hedef /checkout.
  return {
    success: true,
    redirect: result.planExpiredReason ? PLAN_EXPIRED_LOGIN_REDIRECT : null,
    mustChangePassword: result.mustChangePassword,
  }
}

export async function logoutAction() {
  const session = await getSession()
  session.destroy()
  redirect("/login")
}
