import { AppShell } from "@/components/layout/app-shell"
import { SettingsPageHeader } from "@/components/settings/settings-page-header"
import { BrandingForm } from "@/components/settings/branding-form"
import { loadWorkshopSettings } from "../load-workshop-settings"

export const metadata = { title: "Marka" }

export default async function SettingsBrandingPage() {
  const { workshop, serializedSettings } = await loadWorkshopSettings()

  if (!workshop || !serializedSettings) {
    return (
      <AppShell wide>
        <div className="text-center py-12 text-muted-foreground">
          <p>İş yeri bilgisi bulunamadı</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell wide workshopName={workshop.name} pageTitle="Marka">
      <SettingsPageHeader
        title="Marka"
        description="Logo, tema ve marka renklerinizi yönetin."
      />
      <BrandingForm settings={serializedSettings} />
    </AppShell>
  )
}
