import { getAppData } from "@/app/(app)/data"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { AppShell } from "@/components/layout/app-shell"
import { ReportsLayout } from "@/components/reports/reports-layout"
import { OrdersReport } from "@/components/reports/orders-report"
import { ORDER_STATUS } from "@/lib/constants"
import {
  getOrdersReportStats,
  getDailyOrderCounts,
  getMonthlyOrderCounts,
  getExpensiveOrders,
  getLongestDurationOrders,
} from "@/lib/reports/queries"
import { istanbulDateRange } from "@/lib/istanbul-time"
import { prisma } from "@/lib/db"

export const metadata = { title: "Araç Kabul Raporu" }

export default async function OrdersReportPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string; technician?: string; status?: string; customer?: string }>
}) {
  const paywall = await getFeaturePaywall("reports")
  if (paywall) return paywall
  const { user, workshop } = await getAppData()
  const params = await searchParams
  const workshopId = user.workshopId

  // `YYYY-MM-DD` İstanbul günü, bitiş günü dahil → `[start, end)` (#906).
  const { start, end } = istanbulDateRange(params.dateFrom, params.dateTo)

  const [stats, dailyOrders, monthlyOrders, expensiveOrders, longestDuration, technicians] =
    await Promise.all([
      getOrdersReportStats(workshopId, start, end),
      getDailyOrderCounts(workshopId, 14),
      getMonthlyOrderCounts(workshopId, 6),
      getExpensiveOrders(workshopId, start, end, params.technician, params.status, params.customer),
      getLongestDurationOrders(workshopId, start, end, params.technician, params.status, params.customer),
      prisma.technician.findMany({
        where: { workshopId, isActive: true },
        select: { id: true, fullName: true },
        orderBy: { fullName: "asc" },
      }),
    ])

  const statusOptions = Object.entries(ORDER_STATUS).map(([key, val]) => ({
    value: key,
    label: val.label,
  }))

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Araç Kabul Raporu">
      <ReportsLayout>
        <OrdersReport
          stats={stats}
          dailyOrders={dailyOrders}
          monthlyOrders={monthlyOrders}
          expensiveOrders={expensiveOrders}
          longestDuration={longestDuration}
          technicians={technicians}
          statusOptions={statusOptions}
          filters={{ dateFrom: params.dateFrom, dateTo: params.dateTo, technician: params.technician, status: params.status, customer: params.customer }}
        />
      </ReportsLayout>
    </AppShell>
  )
}
