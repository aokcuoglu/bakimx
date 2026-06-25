/** OTP süresi dolmuş mu: now - createdAt > ttlMs. Eşitte/negatifte dolmamış. */
export function isOtpExpired(createdAt: Date, now: Date, ttlMs: number): boolean {
  return now.getTime() - createdAt.getTime() > ttlMs
}
