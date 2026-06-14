import { getAppData } from "@/app/app/data"
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
        <div className="flex items-center text-sm text-slate-500">
          <Link href="/app" className="hover:text-slate-700">Ana Panel</Link>
          <span className="mx-2">/</span>
          <Link href="/app/settings/notifications" className="hover:text-slate-700">Ayarlar</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700 font-medium">Takvim Ayarları</span>
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Takvim Ayarları</h2>
          <p className="text-sm text-slate-500 mt-0.5">Takvim sağlayıcısı ve senkronizasyon ayarları</p>
        </div>
        <CalendarSettings settings={settings} />
      </div>
    </AppShell>
  )
}