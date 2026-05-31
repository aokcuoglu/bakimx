import { prisma } from "@/lib/db"

export interface AuthUser {
  id: string
  email: string
  workshopId: string
  firstName: string | null
  lastName: string | null
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const { getSession } = await import("@/lib/session")
    const session = await getSession()
    if (!session?.userId) return null

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        workshopId: true,
        firstName: true,
        lastName: true,
      },
    })

    if (!user) return null

    return user
  } catch {
    return null
  }
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error("Unauthorized")
  }
  return user
}

/**
 * Returns the current user with workshop data.
 * Throws if user or workshop is missing.
 * Use this for actions that need both user and workshop context.
 */
export async function getCurrentUserWithWorkshop() {
  const user = await requireAuth()
  const workshop = await prisma.workshop.findUnique({
    where: { id: user.workshopId },
  })
  if (!workshop) {
    throw new Error("Workshop not found — hesabınızla ilişkili bir iş yeri bulunamadı")
  }
  return { user, workshop }
}

/**
 * Asserts that the given entity belongs to the specified workshop.
 * Verifies:
 *  - entity is not null/undefined
 *  - entity.workshopId matches the provided workshopId
 *
 * Returns the entity if valid. Throws a descriptive error if access is denied.
 * This is a synchronous helper — call it after obtaining both entity and workshopId.
 */
export function assertWorkshopAccess<T extends { workshopId: string }>(
  entity: T | null | undefined,
  workshopId: string,
  entityLabel: string
): T {
  if (!entity) {
    throw new Error(`${entityLabel} bulunamadı`)
  }
  if (entity.workshopId !== workshopId) {
    throw new Error(`${entityLabel} bu iş yerine ait değil`)
  }
  return entity
}

/**
 * Checks if a given user is already authenticated on the server side.
 * Use in SSR layouts/pages that might render auth pages.
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser()
  return user !== null
}
