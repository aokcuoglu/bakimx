import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/layout/app-shell"
import Link from "next/link"
import { Plus } from "lucide-react"
import { getPlanState, hasFeature } from "@/lib/plan"

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
import { getManagerTechnicianOverview, getUnassignedOrderCount } from "@/lib/technician/queries"
import { getDashboardWidgetData } from "@/lib/reports/queries"
import { getRecommendations } from "@/lib/analytics/queries"
import { KpiCards } from "@/components/dashboard/kpi-cards"
import { CashWidget } from "@/components/dashboard/cash-widget"
import { CriticalStockWidget } from "@/components/dashboard/critical-stock"
import { CriticalStockSuppliersWidget } from "@/components/dashboard/critical-stock-suppliers"
import { AlertBanner } from "@/components/dashboard/alert-banner"
import { ActiveOrdersSection } from "@/components/dashboard/active-orders"
import { TodayDeliveries } from "@/components/dashboard/today-deliveries"
import { WaitingApprovals } from "@/components/dashboard/waiting-approvals"
import { MissingPhotos } from "@/components/dashboard/missing-photos"
import { RecentCustomers } from "@/components/dashboard/recent-customers"
import { WeeklyChart } from "@/components/dashboard/weekly-chart"
import { StatusChart } from "@/components/dashboard/status-chart"
import { TodayAppointments } from "@/components/dashboard/today-appointments"
import { ReminderWidget } from "@/components/dashboard/reminder-widget"
import { TechnicianStatusWidget } from "@/components/dashboard/technician-status"
import { DashboardReportWidgets } from "@/components/dashboard/report-widgets"
import { OperationalAlertsWidget } from "@/components/analytics/operational-alerts-widget"

export default async function DashboardPage() {
  const { user, workshop } = await getAppData()
  const accessTier = getPlanState(workshop!).accessTier
  const canQuotes = hasFeature(accessTier, "quotes")
  const canPhotos = hasFeature(accessTier, "photoChecklist")
  const canAppointments = hasFeature(accessTier, "appointments")
  const canReminders = hasFeature(accessTier, "automatedReminders")
  const canInventory = hasFeature(accessTier, "partsInventory")
  const canProcurement = hasFeature(accessTier, "procurement")
  const canCashbox = hasFeature(accessTier, "cashbox")
  const canTeam = hasFeature(accessTier, "team")
  const canReports = hasFeature(accessTier, "reports")
  const canAnalytics = hasFeature(accessTier, "analytics")

  const [stats, activeOrders, todayDeliveries, recentCustomers] = await Promise.all([
    getDashboardStats(user.workshopId, {
      quotes: canQuotes,
      photoChecklist: canPhotos,
      cashbox: canCashbox,
    }),
    getActiveWorkOrders(user.workshopId, 10),
    getTodayDeliveries(user.workshopId),
    getRecentCustomers(user.workshopId, 6),
  ])

  const [todayAppointments, waitingApprovals, missingPhotos] = await Promise.all([
    canAppointments ? getTodayAppointmentRows(user.workshopId) : Promise.resolve([]),
    canQuotes ? getWaitingApprovals(user.workshopId) : Promise.resolve([]),
    canPhotos ? getMissingPhotoItems(user.workshopId) : Promise.resolve([]),
  ])
  const [remindersDueSoon, remindersOverdue] = canReminders
    ? await Promise.all([
        getDueSoonReminders(user.workshopId, 10),
        getOverdueReminders(user.workshopId, 10),
      ])
    : [[], []]
  const [criticalStock, criticalStockSuppliers] = await Promise.all([
    canInventory ? getCriticalStockItems(user.workshopId, 10) : Promise.resolve([]),
    canInventory && canProcurement
      ? getCriticalStockSuppliers(user.workshopId, 5)
      : Promise.resolve([]),
  ])
  const [technicianOverview, unassignedOrderCount] = canTeam
    ? await Promise.all([
        getManagerTechnicianOverview(user.workshopId),
        getUnassignedOrderCount(user.workshopId),
      ])
    : [[], 0]
  const [weeklyOps, statusDist, reportWidgetData] = canReports
    ? await Promise.all([
        getWeeklyOperations(user.workshopId),
        getWorkStatusDistribution(user.workshopId),
        getDashboardWidgetData(user.workshopId),
      ])
    : [null, null, null]
  const operationalAlerts = canAnalytics
    ? await getRecommendations(user.workshopId)
    : null

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Genel Bakış">
      <div className="space-y-5 sm:space-y-6 max-w-full">
        <div className="relative rounded-lg bg-gradient-to-br from-navy via-navy to-navy-light text-navy-foreground p-5 sm:p-6 shadow-sm overflow-hidden">
          {/* Dekoratif brand blue accent */}
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-brand/15 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-brand/10 blur-2xl pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">
                Hoş Geldiniz, {user.firstName || user.email || user.username || "Kullanıcı"}
              </h2>
              <p className="text-sm text-navy-foreground/70 mt-1">
                {workshop?.name} &bull;{" "}
                {new Date().toLocaleDateString("tr-TR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </p>
            </div>
            <Link
              href="/orders/new"
              className="inline-flex items-center justify-center gap-2 h-8 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors touch-manipulation shadow-sm"
            >
              <Plus className="size-4" />
              Yeni İş Emri
            </Link>
          </div>
        </div>

        <KpiCards stats={stats} showQuotes={canQuotes} showPhotoChecklist={canPhotos} />

        {reportWidgetData && <DashboardReportWidgets data={reportWidgetData} />}

        <AlertBanner stats={stats} showQuotes={canQuotes} showPhotoChecklist={canPhotos} />

        {operationalAlerts && <OperationalAlertsWidget recommendations={operationalAlerts} />}

        {weeklyOps && statusDist && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            <WeeklyChart data={weeklyOps} />
            <StatusChart data={statusDist} />
          </div>
        )}

        <ActiveOrdersSection orders={activeOrders} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          <TodayDeliveries deliveries={todayDeliveries} />
          {canQuotes && <WaitingApprovals approvals={waitingApprovals} />}
          {canPhotos && <MissingPhotos items={missingPhotos} />}
        </div>

        {canAppointments && <TodayAppointments appointments={todayAppointments} />}

        {(canInventory || canCashbox || canReminders) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          {canInventory && <CriticalStockWidget items={criticalStock} />}
          <div className="space-y-4 sm:space-y-5">
            {canCashbox && <CashWidget data={{
              todayCollected: stats.todayCollected,
              openReceivable: stats.openReceivable,
              partialPayments: stats.partialPayments,
            }} />}
            {canInventory && canProcurement && <CriticalStockSuppliersWidget suppliers={criticalStockSuppliers} />}
            {canReminders && <ReminderWidget dueSoon={remindersDueSoon} overdue={remindersOverdue} />}
          </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          <RecentCustomers customers={recentCustomers} />
          {canTeam && <TechnicianStatusWidget technicians={technicianOverview} unassignedCount={unassignedOrderCount} />}
        </div>
      </div>
    </AppShell>
  )
}
