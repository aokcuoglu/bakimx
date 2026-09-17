import { AppShell } from "@/components/layout/app-shell"
import { SettingsPageHeader } from "@/components/settings/settings-page-header"
import { AppointmentRulesForm } from "@/components/settings/appointment-rules-form"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { loadWorkshopSettings } from "../load-workshop-settings"

export const metadata = { title: "Randevu" }

export default async function SettingsAppointmentRulesPage() {
  const paywall = await getFeaturePaywall("appointments")
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
    <AppShell wide workshopName={workshop.name} pageTitle="Randevu">
      <SettingsPageHeader
        title="Randevu"
        description="Varsayılan süre, tampon ve hatırlatma kurallarını yönetin."
      />
      <AppointmentRulesForm settings={serializedSettings} />
    </AppShell>
  )
}
