import { TeamConfigurationForm } from "@/components/settings/team-configuration-form"
import { TeamDetailShell } from "@/components/settings/team-detail-shell"
import { loadTeamPage } from "./load-team"

export const metadata = { title: "Ekip" }

export default async function TeamConfigurationPage({
  params,
}: {
  params: Promise<{ teamId: string }>
}) {
  const { teamId } = await params
  const loaded = await loadTeamPage(teamId)
  if ("paywall" in loaded && loaded.paywall) return loaded.paywall
  if (!("team" in loaded) || !loaded.team || loaded.canManage === undefined) {
    return <p className="py-12 text-center text-muted-foreground">İş yeri bilgisi bulunamadı</p>
  }
  const team = loaded.team
  const canManage = loaded.canManage

  return (
    <TeamDetailShell team={team} active="configuration">
      <TeamConfigurationForm team={team} canManage={canManage} />
    </TeamDetailShell>
  )
}
