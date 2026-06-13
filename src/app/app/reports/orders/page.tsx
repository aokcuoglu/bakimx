import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { ReportsLayout } from "@/components/app/reports/reports-layout"
import { OrdersReport } from "@/components/app/reports/orders-report"
import { ORDER_STATUS } from "@/lib/constants"
import {
  getOrdersReportStats,
  getDailyOrderCounts,
  getMonthlyOrderCounts,
  getExpensiveOrders,
  getLongestDurationOrders,
} from "@/lib/reports/queries"
import { prisma } from "@/lib/db"

export default async function OrdersReportPage({
  searchParams,
}: {
  searchParams: Promise<{ dateFrom?: string; dateTo?: string; technician?: string; status?: string; customer?: string }>
}) {
  const { user, workshop } = await getAppData()
  const params = await searchParams
  const workshopId = user.workshopId

  const dateFrom = params.dateFrom ? new Date(params.dateFrom) : undefined
  const dateTo = params.dateTo ? new Date(params.dateTo) : undefined

  const [stats, dailyOrders, monthlyOrders, expensiveOrders, longestDuration, technicians] =
    await Promise.all([
      getOrdersReportStats(workshopId, dateFrom, dateTo),
      getDailyOrderCounts(workshopId, 14),
      getMonthlyOrderCounts(workshopId, 6),
      getExpensiveOrders(workshopId, dateFrom, dateTo, params.technician, params.status, params.customer),
      getLongestDurationOrders(workshopId, dateFrom, dateTo, params.technician, params.status, params.customer),
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
    <AppShell workshopName={workshop?.name} pageTitle="İş Emri Raporu">
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