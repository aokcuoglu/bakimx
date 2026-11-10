import { getAppData } from "@/app/(app)/data"
import { MembersTeamsTabs } from "@/components/settings/members-teams-tabs"
import { SettingsPageHeader } from "@/components/settings/settings-page-header"
import { TeamManagement } from "@/components/settings/team-management"
import { prisma } from "@/lib/db"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { getEffectiveSeatLimit, getPlanState, hasWorkshopFeature } from "@/lib/plan"
import { actorCan } from "@/lib/roles"
import { getSeatUsage } from "@/lib/rbac"
import { loadWorkshopTeamsForSettings } from "@/lib/workshop-teams"

export const metadata = { title: "Üyeler" }

export default async function MembersSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>
}) {
  const [{ user, workshop }, { invite }] = await Promise.all([getAppData(), searchParams])

  if (!workshop) {
    return <p className="py-12 text-center text-muted-foreground">İş yeri bilgisi bulunamadı</p>
  }
  if (!hasWorkshopFeature(workshop, "team")) return getFeaturePaywall("team")

  // Ekipler ÖNCE: ilk ziyarette varsayılan ekipler burada oluşup üyelere
  // bağlanabilir; üye listesi bunu görmek için sonra okunur (#736).
  const teams = await loadWorkshopTeamsForSettings(user)
  const [members, invites, technicians, seatUsage] = await Promise.all([
        prisma.user.findMany({
          where: { workshopId: user.workshopId },
          select: {
            id: true,
            email: true,
            username: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            technicianId: true,
            teamId: true,
            team: { select: { name: true } },
          },
          orderBy: { createdAt: "asc" },
        }),
        prisma.invite.findMany({
          where: { workshopId: user.workshopId, status: "pending" },
          select: { id: true, email: true, role: true, expiresAt: true },
          orderBy: { createdAt: "desc" },
        }),
        prisma.technician.findMany({
          where: { workshopId: user.workshopId, linkedUsers: { none: {} } },
          select: { id: true, fullName: true, phone: true, role: true, isActive: true, createdAt: true },
          orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
        }),
        getSeatUsage(user.workshopId),
      ])

  const serializedInvites = invites.map((invite) => ({
    id: invite.id,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt.toISOString(),
  }))

  const accountMissingPersonnel = technicians.map((technician) => ({
      id: technician.id,
      fullName: technician.fullName,
      phone: technician.phone,
      role: technician.role,
      isActive: technician.isActive,
      createdAt: technician.createdAt.toISOString(),
    }))

  const seatLimit = getEffectiveSeatLimit(workshop)
  const canManageTeam = actorCan(user, "team.manage")

  return (
    <>
      <SettingsPageHeader
        title="Üyeler ve ekipler"
        description="Üyeleri ve ekipleri yönetin, yetkileri belirleyin ve yeni kullanıcı davet edin."
      />
      <MembersTeamsTabs active="members" />
      <TeamManagement
        members={members.map((member) => ({
          id: member.id,
          email: member.email,
          username: member.username,
          firstName: member.firstName,
          lastName: member.lastName,
          role: member.role,
          isActive: member.isActive,
          technicianId: member.technicianId,
          teamId: member.teamId,
          teamName: member.team?.name ?? null,
        }))}
        teams={teams.map((team) => ({ id: team.id, name: team.name }))}
        invites={serializedInvites}
        currentUserId={user.id}
        currentUserRole={user.role}
        canManage={canManageTeam}
        initialInviteOpen={invite === "1"}
        seatUsed={seatUsage.used}
        seatLimit={seatLimit}
        accessTier={getPlanState(workshop).accessTier}
        workshopName={workshop.name}
        loginCode={workshop.loginCode}
        accountMissingPersonnel={accountMissingPersonnel}
        logoUrl={workshop.logoUrl || undefined}
      />
    </>
  )
}
