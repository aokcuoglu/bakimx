import type { UserRole } from "@prisma/client"
import { prisma } from "@/lib/db"
import { ROLE_DESCRIPTIONS, ROLE_PERMISSIONS, actorCan, parsePermissions, type Permission } from "@/lib/roles"

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

/**
 * Atölyenin ekipleri. **Salt okunur** — hiçbir koşulda yazmaz (#736). Ekip
 * yoksa boş dizi döner; ekipsiz üyeler statik rol matrisiyle çalışmaya devam
 * eder (`actorCan`), yani boş liste yetki açısından eksik bir durum değildir.
 */
export async function listWorkshopTeams(workshopId: string): Promise<WorkshopTeamRecord[]> {
  return readTeams(workshopId)
}

/**
 * Varsayılan ekipleri oluşturmaya kim yetkili: ekipleri yönetebilen ve salt-okunur
 * taklit modunda OLMAYAN aktör. Bir üyenin ya da kurucunun salt-okunur taklidinin
 * sayfayı açması kiracı verisine yazmamalı.
 */
export function canSeedDefaultTeams(actor: {
  role: UserRole
  teamPermissions?: readonly string[] | null
  impersonationReadOnly?: boolean
}): boolean {
  return !actor.impersonationReadOnly && actorCan(actor, "team.manage")
}

/**
 * Ayarlar → Üyeler/Ekipler sayfalarının yükleyicisi. **Bilinçli olarak yazabilir:**
 * aktör `canSeedDefaultTeams` ise ve atölyede hiç ekip yoksa varsayılan ekipleri
 * oluşturur ve ekipsiz üyeleri rolüne göre bağlar (`ensureWorkshopTeams`).
 * Diğer herkese salt okunur liste döner. Yetki değişmez: varsayılan ekip izinleri
 * `ROLE_PERMISSIONS`'ın birebir kopyasıdır.
 *
 * Çağıran, üye listesini bu fonksiyon BİTTİKTEN sonra okumalı — paralel okursa
 * ilk ziyarette yeni atanan ekipler listede görünmez.
 */
export async function loadWorkshopTeamsForSettings(actor: {
  workshopId: string
  role: UserRole
  teamPermissions?: readonly string[] | null
  impersonationReadOnly?: boolean
}): Promise<WorkshopTeamRecord[]> {
  if (!canSeedDefaultTeams(actor)) return listWorkshopTeams(actor.workshopId)
  return ensureWorkshopTeams(actor.workshopId)
}

/**
 * Varsayılan ekipler yoksa bir kez oluşturur ve ekipsiz üyeleri toplu bağlar.
 * YAZAR — yalnız yetkili bir yazma yolundan çağrılmalı
 * (`loadWorkshopTeamsForSettings` ya da bir server action).
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
