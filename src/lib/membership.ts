import type { Prisma, UserRole } from "@prisma/client"
import { prisma } from "@/lib/db"

export type MembershipWorkshopSummary = {
  id: string
  name: string
  city: string
  loginCode: string
  organizationId: string | null
  planTier: string
  logoUrl: string | null
}

export type UserMembership = {
  workshopId: string
  role: UserRole
  isActive: boolean
  workshop: MembershipWorkshopSummary
}

const MEMBERSHIP_WORKSHOP_SELECT = {
  id: true,
  name: true,
  city: true,
  loginCode: true,
  organizationId: true,
  planTier: true,
  logoUrl: true,
} as const satisfies Prisma.WorkshopSelect

/** Active memberships for the switcher, ordered by workshop name. */
export async function listUserMemberships(userId: string): Promise<UserMembership[]> {
  const rows = await prisma.workshopMembership.findMany({
    where: { userId, isActive: true, workshop: { kind: "customer" } },
    select: {
      workshopId: true,
      role: true,
      isActive: true,
      workshop: { select: MEMBERSHIP_WORKSHOP_SELECT },
    },
    orderBy: { workshop: { name: "asc" } },
  })
  return rows
}

export async function findActiveMembership(userId: string, workshopId: string) {
  return prisma.workshopMembership.findFirst({
    where: { userId, workshopId, isActive: true },
    select: {
      id: true,
      role: true,
      workshopId: true,
      workshop: {
        select: {
          ...MEMBERSHIP_WORKSHOP_SELECT,
          approvalStatus: true,
          kind: true,
        },
      },
    },
  })
}

/**
 * Ensure a workshop has an Organization. Legacy rows after migration always do;
 * defensive create covers register paths that forgot to attach one.
 */
export async function ensureWorkshopOrganization(
  workshopId: string,
  workshopName: string,
  existingOrganizationId: string | null | undefined,
  tx: Prisma.TransactionClient = prisma,
): Promise<string> {
  if (existingOrganizationId) return existingOrganizationId
  const org = await tx.organization.create({
    data: { name: workshopName },
    select: { id: true },
  })
  await tx.workshop.update({
    where: { id: workshopId },
    data: { organizationId: org.id },
  })
  return org.id
}

/** Upsert membership and mirror User.workshopId/role (last-active). */
export async function activateWorkshopForUser(input: {
  userId: string
  workshopId: string
  role: UserRole
  tx?: Prisma.TransactionClient
}) {
  const db = input.tx ?? prisma
  await db.workshopMembership.upsert({
    where: { userId_workshopId: { userId: input.userId, workshopId: input.workshopId } },
    create: {
      userId: input.userId,
      workshopId: input.workshopId,
      role: input.role,
      isActive: true,
    },
    update: { role: input.role, isActive: true },
  })
  await db.user.update({
    where: { id: input.userId },
    data: { workshopId: input.workshopId, role: input.role },
  })
}

export { canCreateBranch } from "@/lib/can-create-branch"
