import { notFound } from "next/navigation"
import { getAppData } from "@/app/(app)/data"
import { prisma } from "@/lib/db"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { hasWorkshopFeature } from "@/lib/plan"
import { parsePermissions, actorCan } from "@/lib/roles"

export async function loadTeamPage(teamId: string, options?: { members?: boolean }) {
  const { user, workshop } = await getAppData()
  if (!workshop) return { missing: true as const }
  if (!hasWorkshopFeature(workshop, "team")) {
    return { paywall: await getFeaturePaywall("team") }
  }

  const team = await prisma.workshopTeam.findFirst({
    where: { id: teamId, workshopId: user.workshopId },
    select: {
      id: true,
      name: true,
      description: true,
      permissions: true,
      _count: { select: { members: true } },
      ...(options?.members
        ? {
            members: {
              select: { id: true, firstName: true, lastName: true, email: true, username: true },
              orderBy: { createdAt: "asc" as const },
            },
          }
        : {}),
    },
  })
  if (!team) notFound()

  const permissions = parsePermissions(team.permissions)
  return {
    user,
    workshop,
    canManage: actorCan(user, "team.manage"),
    team: {
      id: team.id,
      name: team.name,
      description: team.description,
      permissions,
      memberCount: team._count.members,
      usageCount: permissions.length,
      members: "members" in team ? team.members : [],
    },
  }
}
