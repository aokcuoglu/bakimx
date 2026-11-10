import { AppShell } from "@/components/layout/app-shell"
import { SettingsPageHeader } from "@/components/settings/settings-page-header"
import { WorkingHoursForm } from "@/components/settings/working-hours-form"
import { loadWorkshopSettings } from "../load-workshop-settings"

export const metadata = { title: "Çalışma saatleri" }

export default async function SettingsWorkingHoursPage() {
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
    <AppShell wide workshopName={workshop.name} pageTitle="Çalışma saatleri">
      <SettingsPageHeader
        title="Çalışma saatleri"
        description="Hafta içi, hafta sonu ve tatil çalışma saatlerinizi ayarlayın."
      />
      <WorkingHoursForm settings={serializedSettings} />
    </AppShell>
  )
}
