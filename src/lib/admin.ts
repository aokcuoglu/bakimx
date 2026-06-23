import { notFound, redirect } from "next/navigation"
import { getCurrentUser, type AuthUser } from "@/lib/auth"

/**
 * Founder/super-admin gate for the /admin console. Membership is configured via
 * the ADMIN_EMAILS env var (comma-separated e-mails) — no schema/role changes.
 * If ADMIN_EMAILS is unset, NOBODY is an admin (the console 404s for everyone).
 */
export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return getAdminEmails().includes(email.trim().toLowerCase())
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  const user = await getCurrentUser()
  return isAdminEmail(user?.email)
}

/**
 * Use in admin pages AND admin server actions. Throws notFound() (404) for
 * non-admins so the console's existence isn't revealed. Returns the admin user.
 */
export async function requireAdmin(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  if (!isAdminEmail(user.email)) notFound()
  return user
}
