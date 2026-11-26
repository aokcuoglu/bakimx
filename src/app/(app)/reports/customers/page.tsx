import { getAppData } from "@/app/(app)/data"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { AppShell } from "@/components/layout/app-shell"
import { ReportsLayout } from "@/components/reports/reports-layout"
import { CustomersReport } from "@/components/reports/customers-report"
import { getCustomerReportStats, getTopCustomersBySpend, getMostVisitedCustomers } from "@/lib/reports/queries"
import { istanbulDateRange } from "@/lib/istanbul-time"

export const metadata = { title: "Müşteri Raporu" }

export default async function CustomersReportPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>
}) {
  const paywall = await getFeaturePaywall("reports")
  if (paywall) return paywall
  const { user, workshop } = await getAppData()
  const params = await searchParams
  const workshopId = user.workshopId

  // `YYYY-MM-DD` İstanbul günü, bitiş günü dahil → `[start, end)` (#906).
  const { start, end } = istanbulDateRange(params.dateFrom, params.dateTo)

  const [stats, topBySpend, mostVisited] = await Promise.all([
    getCustomerReportStats(workshopId, start, end),
    getTopCustomersBySpend(workshopId, 10),
    getMostVisitedCustomers(workshopId, 10),
  ])

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Müşteri Raporu">
      <ReportsLayout>
        <CustomersReport
          stats={stats}
          topBySpend={topBySpend}
          mostVisited={mostVisited}
          filters={{ dateFrom: params.dateFrom, dateTo: params.dateTo }}
        />
      </ReportsLayout>
    </AppShell>
  )
}
