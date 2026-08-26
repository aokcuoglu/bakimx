import { notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { isCurrentUserAdmin } from "@/lib/admin"
import { prisma } from "@/lib/db"

export type SalesAccess =
  | { kind: "admin"; userId: string; advisorId: null }
  | { kind: "advisor"; userId: string; advisorId: string }

/** Sales console gate. Platform admins see the whole pipeline; field advisors
 * are scoped to their own profile. This is intentionally independent from the
 * workshop-scoped UserRole system. */
export async function getSalesAccess(): Promise<SalesAccess> {
  const user = await getCurrentUser()
  if (!user?.isActive) notFound()

  if (await isCurrentUserAdmin()) return { kind: "admin", userId: user.id, advisorId: null }

  const advisor = await prisma.salesAdvisor.findUnique({
    where: { userId: user.id },
    select: { id: true, disabledAt: true },
  })
  if (!advisor || advisor.disabledAt) notFound()
  return { kind: "advisor", userId: user.id, advisorId: advisor.id }
}

export function salesLeadScope(access: SalesAccess) {
  return access.kind === "advisor" ? { advisorId: access.advisorId } : undefined
}

export function assertSalesLeadAccess<T extends { advisorId: string | null }>(
  access: SalesAccess,
  lead: T | null,
): T {
  if (!lead || (access.kind === "advisor" && lead.advisorId !== access.advisorId)) notFound()
  return lead
}
