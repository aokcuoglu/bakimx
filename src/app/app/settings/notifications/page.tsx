import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { NotificationSettings } from "@/components/app/notification-settings"
import { getNotificationTemplates, getCommunicationProviders } from "./actions"
import Link from "next/link"

export default async function NotificationsPage() {
  const { user, workshop } = await getAppData()

  if (!workshop) {
    return (
      <AppShell>
        <div className="text-center py-12 text-muted-foreground">
          <p>İş yeri bilgisi bulunamadı</p>
        </div>
      </AppShell>
    )
  }

  const [templates, providers] = await Promise.all([
    getNotificationTemplates(user.workshopId),
    getCommunicationProviders(),
  ])

  return (
    <AppShell workshopName={workshop.name} pageTitle="Bildirim Ayarları">
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-center text-sm text-slate-500">
          <Link href="/app" className="hover:text-slate-700">Ana Panel</Link>
          <span className="mx-2">/</span>
          <Link href="/app/workshop" className="hover:text-slate-700">Ayarlar</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700 font-medium">Bildirim Ayarları</span>
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Bildirim Ayarları</h2>
          <p className="text-sm text-slate-500 mt-0.5">SMS, WhatsApp ve e-posta bildirim şablonlarını yönetin</p>
        </div>
        <NotificationSettings templates={templates} providers={providers} />
      </div>
    </AppShell>
  )
}