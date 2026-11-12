import { getAppData } from "@/app/(app)/data"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { AppShell } from "@/components/layout/app-shell"
import { SettingsPageHeader } from "@/components/settings/settings-page-header"
import { NotificationSettings } from "@/components/settings/notification-settings"
import { getNotificationTemplates, getCommunicationProviders } from "./actions"

export const metadata = { title: "Bildirim Ayarları" }

export default async function NotificationsPage() {
  const paywall = await getFeaturePaywall("automatedReminders")
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

  const [templates, providers] = await Promise.all([
    getNotificationTemplates(),
    getCommunicationProviders(),
  ])

  return (
    <AppShell wide workshopName={workshop.name} pageTitle="Bildirimler">
      <SettingsPageHeader
        title="Bildirimler"
        description="SMS ve e-posta bildirim şablonlarını yönetin."
      />
      <NotificationSettings templates={templates} providers={providers} />
    </AppShell>
  )
}
