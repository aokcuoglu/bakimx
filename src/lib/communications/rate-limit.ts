const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_PER_WINDOW = 30

const rateLimitStore = new Map<string, number[]>()

export function checkRateLimit(key: string, maxPerMinute: number = RATE_LIMIT_MAX_PER_WINDOW): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_WINDOW_MS
  const attempts = rateLimitStore.get(key) || []
  const recentAttempts = attempts.filter((t) => t > windowStart)

  if (recentAttempts.length >= maxPerMinute) {
    const oldestInWindow = recentAttempts[0]
    const retryAfterMs = oldestInWindow + RATE_LIMIT_WINDOW_MS - now
    return { allowed: false, retryAfterMs: Math.max(retryAfterMs, 0) }
  }

  return { allowed: true, retryAfterMs: 0 }
}

export function recordAttempt(key: string): void {
  const now = Date.now()
  const attempts = rateLimitStore.get(key) || []
  attempts.push(now)
  rateLimitStore.set(key, attempts)

  if (attempts.length > RATE_LIMIT_MAX_PER_WINDOW * 2) {
    const windowStart = now - RATE_LIMIT_WINDOW_MS
    rateLimitStore.set(key, attempts.filter((t) => t > windowStart))
  }
}

export function clearRateLimit(key: string): void {
  rateLimitStore.delete(key)
}