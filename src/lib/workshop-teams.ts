import type { UserRole } from "@prisma/client"
import { prisma } from "@/lib/db"
import { ROLE_DESCRIPTIONS, ROLE_PERMISSIONS, parsePermissions, type Permission } from "@/lib/roles"

export type WorkshopTeamRecord = {
  id: string
  name: string
  description: string | null
  permissions: Permission[]
  memberCount: number
}
const DEFAULT_TEAM_ROLES = ["manager", "usta", "cirak"] as const

const DEFAULT_NAMES: Record<"manager" | "usta" | "cirak", string> = {
  manager: "Servis danışmanı",
  usta: "Usta",
  cirak: "Çırak",
}

async function readTeams(workshopId: string): Promise<WorkshopTeamRecord[]> {
  const teams = await prisma.workshopTeam.findMany({
    where: { workshopId },
    include: { _count: { select: { members: true } } },
    orderBy: { name: "asc" },
  })
  return teams.map(serializeTeam)
}

/** Liste ve detay bunu çağırır. Yazma yok. */
export async function listWorkshopTeams(workshopId: string): Promise<WorkshopTeamRecord[]> {
  const teams = await readTeams(workshopId)
  if (teams.length > 0) return teams
  return ensureWorkshopTeams(workshopId)
}

/**
 * Varsayılan ekipler yoksa bir kez oluşturur ve ekipsiz üyeleri toplu bağlar.
 * Her sayfa geçişinde tekrarlanmaz.
 */
export async function ensureWorkshopTeams(workshopId: string): Promise<WorkshopTeamRecord[]> {
  let teams = await readTeams(workshopId)
  if (teams.length === 0) {
    await prisma.workshopTeam.createMany({
      data: DEFAULT_TEAM_ROLES.map((role) => ({
        workshopId,
        name: DEFAULT_NAMES[role],
        description: ROLE_DESCRIPTIONS[role],
        permissions: [...ROLE_PERMISSIONS[role]],
      })),
    })
    teams = await readTeams(workshopId)
  }

  const byName = new Map(teams.map((team) => [team.name, team.id]))
  const groups = [
    { roles: ["manager"] as UserRole[], teamId: byName.get(DEFAULT_NAMES.manager) },
    { roles: ["usta", "staff"] as UserRole[], teamId: byName.get(DEFAULT_NAMES.usta) },
    { roles: ["cirak"] as UserRole[], teamId: byName.get(DEFAULT_NAMES.cirak) },
  ].filter((group): group is { roles: UserRole[]; teamId: string } => Boolean(group.teamId))

  const wrote = await Promise.all(
    groups.map((group) =>
      prisma.user.updateMany({
        where: { workshopId, teamId: null, role: { in: group.roles } },
        data: { teamId: group.teamId },
      }),
    ),
  )
  if (wrote.every((result) => result.count === 0)) return teams
  return readTeams(workshopId)
}

function serializeTeam(team: {
  id: string
  name: string
  description: string | null
  permissions: string[]
  _count: { members: number }
}): WorkshopTeamRecord {
  return {
    id: team.id,
    name: team.name,
    description: team.description,
    permissions: parsePermissions(team.permissions),
    memberCount: team._count.members,
  }
}
