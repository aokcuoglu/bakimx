import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/app/app-shell"
import { ReportsLayout } from "@/components/app/reports/reports-layout"
import { CustomersReport } from "@/components/app/reports/customers-report"
import { getCustomerReportStats, getTopCustomersBySpend, getMostVisitedCustomers } from "@/lib/reports/queries"

export default async function CustomersReportPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string }>
}) {
  const { user, workshop } = await getAppData()
  const params = await searchParams
  const workshopId = user.workshopId

  const dateFrom = params.dateFrom ? new Date(params.dateFrom) : undefined
  const dateTo = params.dateTo ? new Date(params.dateTo) : undefined

  const [stats, topBySpend, mostVisited] = await Promise.all([
    getCustomerReportStats(workshopId, dateFrom, dateTo),
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