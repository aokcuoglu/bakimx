"use server"

import { loginSchema } from "@/lib/validation"
import { getSession } from "@/lib/session"
import { headers } from "next/headers"
import {
  verifyCredentials,
  loginRateLimit,
  clientIpFromHeaders,
  TOO_MANY_ATTEMPTS_MESSAGE,
} from "@/lib/auth-login"
import { redirect } from "next/navigation"

// NOTE: public self-registration has been removed (no public register flow).
// Accounts are provisioned out-of-band (seed / admin). See README.

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

  return { success: true }
}

export async function logoutAction() {
  const session = await getSession()
  session.destroy()
  redirect("/login")
}
