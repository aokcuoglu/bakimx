import { AppShell } from "@/components/layout/app-shell"
import { SettingsPageHeader } from "@/components/settings/settings-page-header"
import { SecurityInfo } from "@/components/settings/security-info"
import { loadWorkshopSettings } from "../load-workshop-settings"

export const metadata = { title: "Güvenlik" }

export default async function SettingsSecurityPage() {
  const { workshop, serializedWorkshop, serializedUser } = await loadWorkshopSettings()

  if (!workshop || !serializedWorkshop || !serializedUser) {
    return (
      <AppShell wide>
        <div className="text-center py-12 text-muted-foreground">
          <p>İş yeri bilgisi bulunamadı</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell wide workshopName={workshop.name} pageTitle="Güvenlik">
      <SettingsPageHeader
        title="Güvenlik"
        description="İş yeri erişim ve veri güvenliği hakkında bilgi."
      />
      <SecurityInfo workshop={serializedWorkshop} user={serializedUser} />
    </AppShell>
  )
}
