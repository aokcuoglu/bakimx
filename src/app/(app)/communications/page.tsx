import { getAppData } from "@/app/(app)/data"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { AppShell } from "@/components/layout/app-shell"
import { CommunicationLogList } from "@/components/communications/communication-log-list"
import { getCommunicationLogs, getCommunicationStats } from "./actions"
import Link from "next/link"

export const metadata = { title: "İletişim Merkezi" }

export default async function CommunicationsPage() {
  const paywall = await getFeaturePaywall("communications")
  if (paywall) return paywall
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
    <AppShell workshopName={workshop.name}>
      <div className="space-y-5 sm:space-y-6">
        <CommunicationLogList logs={logs} stats={stats} />
      </div>
    </AppShell>
  )
}
