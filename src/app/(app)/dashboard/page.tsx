import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/app/app-shell"
import Link from "next/link"
import { Plus } from "lucide-react"

import {
  getDashboardStats,
  getActiveWorkOrders,
  getTodayDeliveries,
  getTodayAppointmentRows,
  getWaitingApprovals,
  getMissingPhotoItems,
  getRecentCustomers,
  getWeeklyOperations,
  getWorkStatusDistribution,
} from "@/lib/dashboard/queries"
import { getDueSoonReminders, getOverdueReminders } from "@/lib/reminders/queries"
import { getCriticalStockItems } from "@/lib/parts/queries"
import { getCriticalStockSuppliers } from "@/lib/suppliers/queries"
import { getManagerTechnicianOverview } from "@/lib/technician/queries"
import { getDashboardWidgetData } from "@/lib/reports/queries"
import { getRecommendations } from "@/lib/analytics/queries"
import { KpiCards } from "@/components/app/dashboard/kpi-cards"
import { CashWidget } from "@/components/app/dashboard/cash-widget"
import { CriticalStockWidget } from "@/components/app/dashboard/critical-stock"
import { CriticalStockSuppliersWidget } from "@/components/app/dashboard/critical-stock-suppliers"
import { AlertBanner } from "@/components/app/dashboard/alert-banner"
import { ActiveOrdersSection } from "@/components/app/dashboard/active-orders"
import { TodayDeliveries } from "@/components/app/dashboard/today-deliveries"
import { WaitingApprovals } from "@/components/app/dashboard/waiting-approvals"
import { MissingPhotos } from "@/components/app/dashboard/missing-photos"
import { RecentCustomers } from "@/components/app/dashboard/recent-customers"
import { WeeklyChart } from "@/components/app/dashboard/weekly-chart"
import { StatusChart } from "@/components/app/dashboard/status-chart"
import { TodayAppointments } from "@/components/app/dashboard/today-appointments"
import { ReminderWidget } from "@/components/app/dashboard/reminder-widget"
import { TechnicianStatusWidget } from "@/components/app/dashboard/technician-status"
import { DashboardReportWidgets } from "@/components/app/dashboard/report-widgets"
import { OperationalAlertsWidget } from "@/components/app/analytics/operational-alerts-widget"

export default async function DashboardPage() {
  const { user, workshop } = await getAppData()

  const [
    stats,
    activeOrders,
    todayDeliveries,
    todayAppointments,
    waitingApprovals,
    missingPhotos,
    recentCustomers,
    weeklyOps,
    statusDist,
    remindersDueSoon,
    remindersOverdue,
    criticalStock,
    criticalStockSuppliers,
    technicianOverview,
     reportWidgetData,
     operationalAlerts,
  ] = await Promise.all([
    getDashboardStats(user.workshopId),
    getActiveWorkOrders(user.workshopId, 10),
    getTodayDeliveries(user.workshopId),
    getTodayAppointmentRows(user.workshopId),
    getWaitingApprovals(user.workshopId),
    getMissingPhotoItems(user.workshopId),
    getRecentCustomers(user.workshopId, 6),
    getWeeklyOperations(user.workshopId),
    getWorkStatusDistribution(user.workshopId),
    getDueSoonReminders(user.workshopId, 10),
    getOverdueReminders(user.workshopId, 10),
    getCriticalStockItems(user.workshopId, 10),
    getCriticalStockSuppliers(user.workshopId, 5),
    getManagerTechnicianOverview(user.workshopId),
    getDashboardWidgetData(user.workshopId),
    getRecommendations(user.workshopId),
  ])

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Genel Bakış">
      <div className="space-y-5 sm:space-y-6 max-w-full">
        <div className="relative rounded-lg bg-gradient-to-br from-navy via-navy to-navy-light text-white p-5 sm:p-6 shadow-sm overflow-hidden">
          {/* Dekoratif brand blue accent */}
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-brand/15 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-brand/10 blur-2xl pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">
                Hoş Geldiniz, {user.firstName || user.email}
              </h2>
              <p className="text-sm text-white/70 mt-1">
                {workshop?.name} &bull;{" "}
                {new Date().toLocaleDateString("tr-TR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
            </div>
            <Link
              href="/intakes/new"
              className="inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors touch-manipulation shadow-sm"
            >
              <Plus className="size-4" />
              Yeni İş Emri
            </Link>
          </div>
        </div>

        <KpiCards stats={stats} />

        <DashboardReportWidgets data={reportWidgetData} />

        <AlertBanner stats={stats} />

        <OperationalAlertsWidget recommendations={operationalAlerts} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          <WeeklyChart data={weeklyOps} />
          <StatusChart data={statusDist} />
        </div>

        <ActiveOrdersSection orders={activeOrders} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          <TodayDeliveries deliveries={todayDeliveries} />
          <WaitingApprovals approvals={waitingApprovals} />
          <MissingPhotos items={missingPhotos} />
        </div>

        <TodayAppointments appointments={todayAppointments} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          <CriticalStockWidget items={criticalStock} />
          <div className="space-y-4 sm:space-y-5">
            <CashWidget data={{
              todayCollected: stats.todayCollected,
              openReceivable: stats.openReceivable,
              partialPayments: stats.partialPayments,
            }} />
            <CriticalStockSuppliersWidget suppliers={criticalStockSuppliers} />
            <ReminderWidget dueSoon={remindersDueSoon} overdue={remindersOverdue} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          <RecentCustomers customers={recentCustomers} />
          <TechnicianStatusWidget technicians={technicianOverview} />
        </div>
      </div>
    </AppShell>
  )
}