import { notFound } from "next/navigation"
import { getCurrentUser } from "@/lib/auth"
import { isCurrentUserAdmin, requireAdminCapability } from "@/lib/admin"
import { can, isAdminSessionRevoked, type AdminCapability, type AdminRole } from "@/lib/admin-roles"
import { prisma } from "@/lib/db"
import { getSession } from "@/lib/session"

export type SalesCapability = Extract<
  AdminCapability,
  | "viewSales"
  | "manageSalesPipeline"
  | "manageSalesAdvisors"
  | "viewSalesCommissions"
  | "manageSalesCommissions"
>

export type SalesAccess =
  | { kind: "admin"; userId: string; advisorId: null; adminRole: AdminRole }
  | { kind: "advisor"; userId: string; advisorId: string; adminRole: null }

const ADVISOR_CAPABILITIES: readonly SalesCapability[] = [
  "viewSales",
  "manageSalesPipeline",
  "viewSalesCommissions",
]

export function canAccessSales(access: SalesAccess, capability: SalesCapability): boolean {
  return access.kind === "admin"
    ? can({ adminRole: access.adminRole }, capability)
    : ADVISOR_CAPABILITIES.includes(capability)
}

/** Sales console gate. Platform admins see the whole pipeline; field advisors
 * are scoped to their own profile. This is intentionally independent from the
 * workshop-scoped UserRole system. */
export async function getSalesAccess(capability: SalesCapability = "viewSales"): Promise<SalesAccess> {
  const user = await getCurrentUser()
  if (!user?.isActive) notFound()

  if (await isCurrentUserAdmin()) {
    const ctx = await requireAdminCapability(capability)
    return { kind: "admin", userId: user.id, advisorId: null, adminRole: ctx.adminRole }
  }

  if (user.workshopKind !== "internal" || !ADVISOR_CAPABILITIES.includes(capability)) notFound()

  const advisor = await prisma.salesAdvisor.findUnique({
    where: { userId: user.id },
    select: { id: true, disabledAt: true, sessionsValidFrom: true },
  })
  if (!advisor || advisor.disabledAt) notFound()
  const session = await getSession()
  if (isAdminSessionRevoked(session.authenticatedAt, advisor.sessionsValidFrom)) notFound()
  return { kind: "advisor", userId: user.id, advisorId: advisor.id, adminRole: null }
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
