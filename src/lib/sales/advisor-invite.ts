import { buildInviteUrl, generateInviteToken, hashInviteToken } from "@/lib/invite"

export const SALES_ADVISOR_INVITE_TTL_MS = 72 * 60 * 60 * 1000

export { generateInviteToken as generateSalesAdvisorInviteToken }
export { hashInviteToken as hashSalesAdvisorInviteToken }

export function salesAdvisorInviteExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + SALES_ADVISOR_INVITE_TTL_MS)
}

export function isSalesAdvisorInviteExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime()
}

export function buildSalesAdvisorInviteUrl(origin: string, token: string): string {
  return buildInviteUrl(origin, `sales/${token}`)
}
