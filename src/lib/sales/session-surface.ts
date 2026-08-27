import { prisma } from "@/lib/db"
import type { SessionSurface } from "@/lib/technician-route-access"

/** Resolve the post-login surface from live DB membership, never from input. */
export async function resolveSessionSurface(
  userId: string,
  workshopId: string,
): Promise<SessionSurface> {
  const advisor = await prisma.salesAdvisor.findFirst({
    where: {
      userId,
      disabledAt: null,
      user: {
        isActive: true,
        workshopId,
        workshop: { kind: "internal" },
      },
    },
    select: { id: true },
  })
  return advisor ? "sales" : "tenant"
}
