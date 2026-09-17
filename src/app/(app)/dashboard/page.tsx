import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/layout/app-shell"
import Link from "next/link"
import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/button"
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

export const metadata = { title: "Genel Bakış" }

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
  const needsFirstOrder = accessTier === "lite" && !(await prisma.serviceOrder.findFirst({ where: { workshopId: user.workshopId }, select: { id: true } }))

  const operationalAlerts = canAnalytics
    ? await getRecommendations(user.workshopId)
    : null

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Genel Bakış">
      <div className="mx-auto max-w-[1440px] space-y-6 sm:space-y-8">
        <section
          data-tour="welcome-banner"
          className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between sm:pb-8"
        >
          <div className="min-w-0">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Genel Bakış</p>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Hoş Geldiniz, {user.firstName || user.email || user.username || "Kullanıcı"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {workshop?.name} &bull;{" "}
              {new Date().toLocaleDateString("tr-TR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </p>
          </div>
          <Button variant="foreground" size="sm" asChild>
            <Link href="/orders/new" data-tour="welcome-cta">
              <Plus className="size-4" />
              Yeni İş Emri
            </Link>
          </Button>
        </section>

        {needsFirstOrder && (
          <section
            data-tour="first-order"
            aria-labelledby="first-order-heading"
            className="rounded-xl border bg-card p-4 space-y-3"
          >
            <h2 id="first-order-heading" className="text-lg font-semibold">Lite ile ilk işinize başlayın</h2>
            <p className="text-sm text-muted-foreground">Kurulum tercihleriniz kaydedildi. İlk müşterinizi ve aracınızı kaydedin, ardından iş emrinizi açın. İş emri ekranında da müşteri ve araç ekleyebilirsiniz.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild variant="outline"><Link href="/customers/new">İlk müşteriyi ekle</Link></Button>
              <Button variant="foreground" asChild><Link href="/orders/new">İlk iş emrini oluştur</Link></Button>
            </div>
          </section>
        )}

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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <TodayDeliveries deliveries={todayDeliveries} />
          {canQuotes && <WaitingApprovals approvals={waitingApprovals} />}
          {canPhotos && <MissingPhotos items={missingPhotos} />}
        </div>

        {canAppointments && <TodayAppointments appointments={todayAppointments} />}

        {(canInventory || canCashbox || canReminders) && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <RecentCustomers customers={recentCustomers} />
          {canTeam && <TechnicianStatusWidget technicians={technicianOverview} unassignedCount={unassignedOrderCount} />}
        </div>
      </div>
    </AppShell>
  )
}
