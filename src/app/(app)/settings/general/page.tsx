import { AppShell } from "@/components/layout/app-shell"
import { SettingsPageHeader } from "@/components/settings/settings-page-header"
import { BusinessProfileForm } from "@/components/settings/business-profile-form"
import { loadWorkshopSettings } from "../load-workshop-settings"

export const metadata = { title: "Genel" }

export default async function SettingsGeneralPage() {
  const { workshop, serializedWorkshop, serializedSettings } = await loadWorkshopSettings()

  if (!workshop || !serializedWorkshop || !serializedSettings) {
    return (
      <AppShell wide>
        <div className="text-center py-12 text-muted-foreground">
          <p>İş yeri bilgisi bulunamadı</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell wide workshopName={workshop.name} pageTitle="Genel">
      <SettingsPageHeader
        title="Genel"
        description="İş yeri profilinizi, fatura ve iletişim bilgilerinizi yönetin."
      />
      <BusinessProfileForm workshop={serializedWorkshop} contact={serializedSettings} />
    </AppShell>
  )
}
