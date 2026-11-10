import { getAppData } from "@/app/(app)/data"
import { MembersTeamsTabs } from "@/components/settings/members-teams-tabs"
import { SettingsPageHeader } from "@/components/settings/settings-page-header"
import { WorkshopTeamsPanel } from "@/components/settings/workshop-teams-panel"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { hasWorkshopFeature } from "@/lib/plan"
import { actorCan } from "@/lib/roles"
import { loadWorkshopTeamsForSettings } from "@/lib/workshop-teams"

export const metadata = { title: "Ekipler" }

export default async function TeamsSettingsPage() {
  const { user, workshop } = await getAppData()
  if (!workshop) {
    return <p className="py-12 text-center text-muted-foreground">İş yeri bilgisi bulunamadı</p>
  }
  if (!hasWorkshopFeature(workshop, "team")) return getFeaturePaywall("team")

  const teams = await loadWorkshopTeamsForSettings(user)

  return (
    <>
      <SettingsPageHeader
        title="Üyeler ve ekipler"
        description="Ekip kurun ve her ekibin yapabileceği işleri işaretleyin. Yönetici her zaman tam yetkilidir."
      />
      <MembersTeamsTabs active="teams" />
      <WorkshopTeamsPanel teams={teams} canManage={actorCan(user, "team.manage")} />
    </>
  )
}
