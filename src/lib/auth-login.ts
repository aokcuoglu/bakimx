import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import { rateLimit } from "@/lib/rate-limit"

/**
 * Shared, hardened login core used by both the `/api/auth/login` route and the
 * `loginAction` server action so there is a single, consistent auth path.
 *
 * Protections:
 *  - account enumeration: an unknown e-mail still runs a bcrypt comparison
 *    against a fixed dummy hash so the response timing matches the
 *    wrong-password path (no fast "user not found" exit).
 *  - rate limiting: per-client-IP attempt cap (see `loginRateLimit`).
 */

// Pre-computed bcrypt hash (cost 12) of a random string. Never matches a real
// password; used only to equalize timing on the unknown-email path.
const DUMMY_PASSWORD_HASH = "$2b$12$y1Gj5wAfKoZb8LIr83/3s.fWWfiLbYhgB08D9fqk4xZILKzrGNl8y"

// Generic message — identical for unknown e-mail and wrong password.
export const INVALID_CREDENTIALS_MESSAGE = "E-posta adresi veya şifre hatalı"
export const NO_WORKSHOP_MESSAGE =
  "Hesabınıza bağlı iş yeri bulunamadı. Lütfen destek ile iletişime geçin."
export const TOO_MANY_ATTEMPTS_MESSAGE =
  "Çok fazla deneme yapıldı. Lütfen bir dakika sonra tekrar deneyin."

const LOGIN_MAX_ATTEMPTS = 8
const LOGIN_WINDOW_MS = 60_000

export type LoginResult =
  | { ok: true; userId: string; workshopId: string }
  | { ok: false; error: string }

/**
 * Extract a best-effort client IP from request headers for rate-limit keying.
 */
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return headers.get("x-real-ip") || "unknown"
}

/**
 * Per-IP login rate limit. Returns whether the attempt is allowed.
 */
export function loginRateLimit(ip: string): { allowed: boolean; retryAfterMs: number } {
  return rateLimit(`login:${ip}`, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS)
}

/**
 * Verify credentials in constant-ish time. Always performs a bcrypt comparison
 * (real hash or dummy) before returning a generic failure.
 */
export async function verifyCredentials(email: string, password: string): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { email } })

  // Equalize timing: compare against a dummy hash when the user is unknown.
  const hashToCompare = user?.password ?? DUMMY_PASSWORD_HASH
  const passwordValid = await bcrypt.compare(password, hashToCompare)

  if (!user || !passwordValid) {
    return { ok: false, error: INVALID_CREDENTIALS_MESSAGE }
  }

  const workshop = await prisma.workshop.findUnique({
    where: { id: user.workshopId },
    select: { id: true },
  })
  if (!workshop) {
    return { ok: false, error: NO_WORKSHOP_MESSAGE }
  }

  return { ok: true, userId: user.id, workshopId: user.workshopId }
}
