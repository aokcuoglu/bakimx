import { randomBytes, createHash } from "node:crypto"

/**
 * Password-reset token helpers.
 *
 * The raw token is sent only in the password-reset e-mail. We persist
 * `sha256(token)` (hex) as `PasswordReset.tokenHash`, so a database leak cannot
 * reproduce a usable reset link. Lookups hash the incoming token and match.
 */

export const RESET_TTL_MS = 60 * 60 * 1000 // 1 hour

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function generateResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url")
  return { token, tokenHash: hashResetToken(token) }
}

export function resetExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + RESET_TTL_MS)
}

export function isResetExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() < Date.now()
}
