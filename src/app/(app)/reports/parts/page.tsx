import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/app/app-shell"
import { ReportsLayout } from "@/components/app/reports/reports-layout"
import { PartsReport } from "@/components/app/reports/parts-report"
import { getPartsReportStats, getMostUsedParts, getLowestStockParts } from "@/lib/reports/queries"

export default async function PartsReportPage() {
  const { user, workshop } = await getAppData()
  const workshopId = user.workshopId

  const [stats, mostUsed, lowestStock] = await Promise.all([
    getPartsReportStats(workshopId),
    getMostUsedParts(workshopId, 10),
    getLowestStockParts(workshopId, 10),
  ])

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Parça Raporu">
      <ReportsLayout>
        <PartsReport stats={stats} mostUsed={mostUsed} lowestStock={lowestStock} />
      </ReportsLayout>
    </AppShell>
  )
}