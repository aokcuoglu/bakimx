import { getIronSession } from "iron-session"
import { cookies } from "next/headers"

/**
 * Founder impersonation overlay. Layered ON TOP of the real session — the real
 * admin identity (userId/workshopId) is never overwritten, so impersonation is
 * a separate, revocable fact. When present and unexpired, getCurrentUser()
 * resolves the EFFECTIVE user as `targetUserId`, scoping the whole app to the
 * target tenant with zero per-query changes.
 */
export interface ImpersonationOverlay {
  adminUserId: string
  targetUserId: string
  targetWorkshopId: string
  /** FK to the ImpersonationSession row (revocation handle). */
  sessionId: string
  /** Hard expiry as epoch ms — checked without a DB hit. */
  expiresAt: number
  /** P2: always true. A read-only context blocks tenant-data writes. */
  readOnly: boolean
}

export interface SessionData {
  userId?: string
  workshopId?: string
  impersonation?: ImpersonationOverlay
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.trim() === "") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_SECRET ortam değişkeni production ortamında zorunludur. " +
          "Lütfen .env dosyanıza en az 32 karakter uzunluğunda rastgele bir SESSION_SECRET ekleyin."
      )
    }
    return "complex_password_at_least_32_characters_long_for_dev"
  }
  if (process.env.NODE_ENV === "production" && secret.length < 32) {
    throw new Error(
      "SESSION_SECRET en az 32 karakter uzunluğunda olmalıdır. " +
        "Mevcut uzunluk: " + secret.length
    )
  }
  return secret
}

export const sessionOptions = {
  password: getSessionSecret(),
  // `||` (not `??`) so an empty build-arg/env falls back to the prod default.
  cookieName: process.env.SESSION_COOKIE_NAME || "bakimx_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
    // Prod shares the session across bakimx.com (login) + app.bakimx.com via `.bakimx.com`.
    // Staging overrides SESSION_COOKIE_DOMAIN (its own host) + SESSION_COOKIE_NAME so its
    // cookie never collides with / overwrites prod's. These are read in the Edge middleware
    // too, so the per-env value is baked at build time via Dockerfile build-args (the
    // staging workflow passes them); runtime env keeps the Node routes consistent.
    domain:
      process.env.NODE_ENV === "production"
        ? (process.env.SESSION_COOKIE_DOMAIN || ".bakimx.com")
        : undefined,
  },
}

export async function getSession() {
  const cookieStore = await cookies()
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions)
  return session
}

/**
 * The active (present + unexpired) impersonation overlay, or null. Safe to call
 * outside a request scope (cron, scripts): cookies() throws there → returns null.
 * Used by getCurrentUser() (effective identity) and the Prisma write-guard.
 */
export async function getActiveImpersonation(): Promise<ImpersonationOverlay | null> {
  try {
    const session = await getSession()
    const imp = session.impersonation
    if (imp && Date.now() < imp.expiresAt) return imp
    return null
  } catch {
    return null
  }
}
