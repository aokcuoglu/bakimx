const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

const WINDOW_MS = 60_000
const MAX_REQUESTS = 30

export function rateLimit(key: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + WINDOW_MS })
    return { allowed: true, retryAfterMs: 0 }
  }

  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, retryAfterMs: entry.resetTime - now }
  }

  entry.count += 1
  return { allowed: true, retryAfterMs: 0 }
}