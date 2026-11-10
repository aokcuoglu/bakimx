import { TeamDetailShell } from "@/components/settings/team-detail-shell"
import { TeamMembersPanel, type TeamMemberRow } from "@/components/settings/team-members-panel"
import { prisma } from "@/lib/db"
import { loadTeamPage } from "../load-team"

export const metadata = { title: "Ekip üyeleri" }

function row(member: { id: string; firstName: string | null; lastName: string | null; email: string | null; username: string | null }): TeamMemberRow {
  const name = `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim()
  const identity = member.email ?? member.username ?? "—"
  return { id: member.id, name: name || identity, identity }
}

export default async function TeamMembersPage({
  params,
}: {
  params: Promise<{ teamId: string }>
}) {
  const { teamId } = await params
  const loaded = await loadTeamPage(teamId, { members: true })
  if ("paywall" in loaded && loaded.paywall) return loaded.paywall
  if (!("team" in loaded) || !loaded.team || !loaded.user || loaded.canManage === undefined) {
    return <p className="py-12 text-center text-muted-foreground">İş yeri bilgisi bulunamadı</p>
  }
  const team = loaded.team
  const canManage = loaded.canManage
  const user = loaded.user
  const others = await prisma.user.findMany({
    where: { workshopId: user.workshopId, role: { not: "owner" }, NOT: { teamId: team.id } },
    select: { id: true, firstName: true, lastName: true, email: true, username: true },
    orderBy: { createdAt: "asc" },
  })

  return (
    <TeamDetailShell team={team} active="members">
      <TeamMembersPanel
        teamId={team.id}
        canManage={canManage}
        members={team.members.map(row)}
        candidates={others.map(row)}
      />
    </TeamDetailShell>
  )
}
