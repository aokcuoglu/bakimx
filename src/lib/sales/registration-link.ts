import { createHash, randomBytes } from "node:crypto"

export const SALES_REGISTRATION_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000

export type SalesRegistrationLinkState = "active" | "expired" | "revoked" | "used"

export function hashSalesRegistrationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function generateSalesRegistrationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url")
  return { token, tokenHash: hashSalesRegistrationToken(token) }
}

export function salesRegistrationLinkExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + SALES_REGISTRATION_LINK_TTL_MS)
}

export function salesRegistrationLinkState(
  link: { expiresAt: Date; revokedAt: Date | null; usedAt: Date | null },
  now: Date = new Date(),
): SalesRegistrationLinkState {
  if (link.usedAt) return "used"
  if (link.revokedAt) return "revoked"
  if (link.expiresAt.getTime() <= now.getTime()) return "expired"
  return "active"
}

export function buildSalesRegistrationPath(token: string): string {
  return `/register/sales/${encodeURIComponent(token)}`
}

export function buildSalesRegistrationUrl(origin: string, token: string): string {
  return new URL(buildSalesRegistrationPath(token), `${origin.replace(/\/$/, "")}/`).toString()
}
