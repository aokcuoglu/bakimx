import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { CommunicationLogList } from "@/components/app/communication-log-list"
import { getCommunicationLogs, getCommunicationStats } from "./actions"
import Link from "next/link"

export default async function CommunicationsPage() {
  const { workshop } = await getAppData()

  if (!workshop) {
    return (
      <AppShell>
        <div className="text-center py-12 text-muted-foreground">
          <p>İş yeri bilgisi bulunamadı</p>
        </div>
      </AppShell>
    )
  }

  const [logs, stats] = await Promise.all([
    getCommunicationLogs(),
    getCommunicationStats(),
  ])

  return (
    <AppShell workshopName={workshop.name} pageTitle="İletişim Kayıtları">
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-center text-sm text-muted-foreground">
          <Link href="/app" className="hover:text-foreground">Ana Panel</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">İletişim Kayıtları</span>
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">İletişim Kayıtları</h2>
          <p className="text-sm text-muted-foreground mt-0.5">SMS, WhatsApp ve e-posta iletişim geçmişi</p>
        </div>
        <CommunicationLogList logs={logs} stats={stats} />
      </div>
    </AppShell>
  )
}