"use server"

import { loginSchema } from "@/lib/validations/auth"
import { getSession } from "@/lib/session"
import { headers } from "next/headers"
import {
  verifyCredentials,
  loginRateLimit,
  clientIpFromHeaders,
  PLAN_EXPIRED_LOGIN_REDIRECT,
  TOO_MANY_ATTEMPTS_MESSAGE,
} from "@/lib/auth-login"
import { redirect } from "next/navigation"

// NOTE: self-serve signup (see /register) creates a workshop in `pending` status.
// Pending workshops CAN sign in — they land on the full-screen card-verification
// lock ((app)/layout.tsx) and start their trial once the card is verified. Only
// `rejected` workshops are blocked at login. Accounts may also be provisioned via
// seed / admin.

export async function loginAction(formData: FormData) {
  const raw = {
    email: (formData.get("email") as string || "").trim().toLowerCase(),
    password: formData.get("password") as string,
  }

  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  const ip = clientIpFromHeaders(await headers())
  const limit = loginRateLimit(ip)
  if (!limit.allowed) {
    return { error: TOO_MANY_ATTEMPTS_MESSAGE }
  }

  const result = await verifyCredentials(parsed.data.email, parsed.data.password)
  if (!result.ok) {
    return { error: result.error }
  }

  // Rotate the session on login (clear any pre-existing data first).
  const session = await getSession()
  session.destroy()
  session.userId = result.userId
  session.workshopId = result.workshopId
  await session.save()

  // API rotasıyla aynı sözleşme: planı bitmişse hedef /checkout.
  return {
    success: true,
    redirect: result.planExpiredReason ? PLAN_EXPIRED_LOGIN_REDIRECT : null,
  }
}

export async function logoutAction() {
  const session = await getSession()
  session.destroy()
  redirect("/login")
}
