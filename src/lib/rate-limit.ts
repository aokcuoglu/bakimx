const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

const WINDOW_MS = 60_000
const MAX_REQUESTS = 30

/**
 * In-memory fixed-window rate limiter.
 *
 * NOTE: state is per-process only. It is effective for a single instance but
 * does NOT coordinate across multiple instances; move to a shared store
 * (Redis/Postgres) before horizontal scaling.
 *
 * @param key      unique bucket key (e.g. `login:<ip>`)
 * @param max      max requests per window (default 30)
 * @param windowMs window length in ms (default 60s)
 */
export function rateLimit(
  key: string,
  max: number = MAX_REQUESTS,
  windowMs: number = WINDOW_MS
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs })
    return { allowed: true, retryAfterMs: 0 }
  }

  if (entry.count >= max) {
    return { allowed: false, retryAfterMs: entry.resetTime - now }
  }

  entry.count += 1
  return { allowed: true, retryAfterMs: 0 }
}