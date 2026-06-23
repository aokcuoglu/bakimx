import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/app/app-shell"
import { CalendarSettings } from "@/components/app/calendar-settings"
import { getCalendarSettings } from "./actions"
import Link from "next/link"

export default async function CalendarSettingsPage() {
  const { user: _user, workshop } = await getAppData()

  if (!workshop) {
    return (
      <AppShell>
        <div className="text-center py-12 text-muted-foreground">
          <p>İş yeri bilgisi bulunamadı</p>
        </div>
      </AppShell>
    )
  }

  const settings = await getCalendarSettings()

  return (
    <AppShell workshopName={workshop.name} pageTitle="Takvim Ayarları">
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-center text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground">Ana Panel</Link>
          <span className="mx-2">/</span>
          <Link href="/settings/notifications" className="hover:text-foreground">Ayarlar</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">Takvim Ayarları</span>
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Takvim Ayarları</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Takvim sağlayıcısı ve senkronizasyon ayarları</p>
        </div>
        <CalendarSettings settings={settings} />
      </div>
    </AppShell>
  )
}