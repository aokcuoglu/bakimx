import { randomBytes, createHash } from "node:crypto"

/**
 * Team-invite token helpers.
 *
 * The raw token is sent only in the e-mailed accept URL. We persist
 * `sha256(token)` (hex) as `Invite.tokenHash`, so a database leak cannot
 * reproduce a usable invite link. Lookups hash the incoming token and match.
 */

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function generateInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url")
  return { token, tokenHash: hashInviteToken(token) }
}

export function inviteExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITE_TTL_MS)
}

export function isInviteExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() < Date.now()
}

/** Absolute accept URL. `origin` should come from the request headers. */
export function buildInviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/invite/${token}`
}
