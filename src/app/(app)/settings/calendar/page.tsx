import { getAppData } from "@/app/(app)/data"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { AppShell } from "@/components/layout/app-shell"
import { SettingsPageHeader } from "@/components/settings/settings-page-header"
import { CalendarSettings } from "@/components/settings/calendar-settings"
import { getCalendarSettings } from "./actions"

export const metadata = { title: "Takvim Ayarları" }

export default async function CalendarSettingsPage() {
  const paywall = await getFeaturePaywall("appointments")
  if (paywall) return paywall
  const { workshop } = await getAppData()

  if (!workshop) {
    return (
      <AppShell wide>
        <div className="text-center py-12 text-muted-foreground">
          <p>İş yeri bilgisi bulunamadı</p>
        </div>
      </AppShell>
    )
  }

  const settings = await getCalendarSettings()

  return (
    <AppShell wide workshopName={workshop.name} pageTitle="Takvim">
      <SettingsPageHeader
        title="Takvim"
        description="Takvim sağlayıcısı ve senkronizasyon ayarları."
      />
      <CalendarSettings settings={settings} />
    </AppShell>
  )
}
