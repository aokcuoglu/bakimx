import { AppShell } from "@/components/layout/app-shell"
import { SettingsPageHeader } from "@/components/settings/settings-page-header"
import { CommunicationSettingsForm } from "@/components/settings/communication-settings-form"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { loadWorkshopSettings } from "../load-workshop-settings"

export const metadata = { title: "İletişim" }

export default async function SettingsCommunicationPage() {
  const paywall = await getFeaturePaywall("communications")
  if (paywall) return paywall

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
    <AppShell wide workshopName={workshop.name} pageTitle="İletişim">
      <SettingsPageHeader
        title="İletişim"
        description="SMS ve e-posta sağlayıcı ayarlarını yönetin."
      />
      <CommunicationSettingsForm settings={serializedSettings} />
    </AppShell>
  )
}
