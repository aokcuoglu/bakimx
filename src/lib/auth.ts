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