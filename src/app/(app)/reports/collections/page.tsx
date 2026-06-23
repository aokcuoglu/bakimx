import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/app/app-shell"
import { ReportsLayout } from "@/components/app/reports/reports-layout"
import { CollectionsReport } from "@/components/app/reports/collections-report"
import { getCollectionReportStats, getDailyCollectionAmounts, getMonthlyCollectionAmounts } from "@/lib/reports/queries"

export default async function CollectionsReportPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>
}) {
  const { user, workshop } = await getAppData()
  const params = await searchParams
  const workshopId = user.workshopId

  const dateFrom = params.dateFrom ? new Date(params.dateFrom) : undefined
  const dateTo = params.dateTo ? new Date(params.dateTo) : undefined

  const [stats, dailyCollections, monthlyCollections] = await Promise.all([
    getCollectionReportStats(workshopId, dateFrom, dateTo),
    getDailyCollectionAmounts(workshopId, 14),
    getMonthlyCollectionAmounts(workshopId, 6),
  ])

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Tahsilat Raporu">
      <ReportsLayout>
        <CollectionsReport
          stats={stats}
          dailyCollections={dailyCollections}
          monthlyCollections={monthlyCollections}
          filters={{ dateFrom: params.dateFrom, dateTo: params.dateTo }}
        />
      </ReportsLayout>
    </AppShell>
  )
}