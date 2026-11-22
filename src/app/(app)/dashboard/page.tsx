import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/layout/app-shell"
import Link from "next/link"
import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/button"
import styles from "@/components/dashboard/dashboard-layout.module.css"
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
import { OperationalAlertsWidget } from "@/components/analytics/operational-alerts-widget"
import { DashPanel, surface } from "@/components/dashboard/surface"

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
  const [weeklyOps, statusDist] = canReports
    ? await Promise.all([
        getWeeklyOperations(user.workshopId),
        getWorkStatusDistribution(user.workshopId),
      ])
    : [null, null]
  const needsFirstOrder = accessTier === "lite" && !(await prisma.serviceOrder.findFirst({ where: { workshopId: user.workshopId }, select: { id: true } }))

  const operationalAlerts = canAnalytics
    ? await getRecommendations(user.workshopId)
    : null

  const greetingName = user.firstName || null

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Genel Bakış">
      <div className={surface.root}>
        <section data-tour="welcome-banner" className={surface.hero}>
          <div className="min-w-0">
            <h1 className={surface.heroTitle}>{workshop?.name || "Genel Bakış"}</h1>
            <p className={surface.heroSub}>
              Bugün ·{" "}
              {new Date().toLocaleDateString("tr-TR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              {greetingName ? ` · Hoş geldiniz, ${greetingName}` : ""}
            </p>
          </div>
          <Button variant="default" className={surface.heroCta} asChild>
            <Link href="/orders/new" data-tour="welcome-cta">
              <Plus className="size-4" />
              Yeni Araç Kabul
            </Link>
          </Button>
        </section>

        {needsFirstOrder && (
          <DashPanel title="İlk adım" data-tour="first-order">
            <div className={surface.cardBody}>
              <h2 className="text-[22px] font-bold leading-7 tracking-[-0.025em]">Lite ile ilk işinize başlayın</h2>
              <p className="mt-2 text-[17px] leading-6 text-muted-foreground">Kurulum tercihleriniz kaydedildi. İlk müşterinizi ve aracınızı kaydedin, ardından araç kabulünüzü açın. Araç kabul ekranında da müşteri ve araç ekleyebilirsiniz.</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button asChild variant="outline" className="rounded-full"><Link href="/customers/new">İlk müşteriyi ekle</Link></Button>
                <Button variant="default" asChild className="rounded-full"><Link href="/orders/new">İlk araç kabulünü oluştur</Link></Button>
              </div>
            </div>
          </DashPanel>
        )}

        <KpiCards stats={stats} showQuotes={canQuotes} />

        <section aria-label="Operasyon takibi" className={styles.panels}>
          <AlertBanner stats={stats} showQuotes={canQuotes} showPhotoChecklist={canPhotos} />
          {operationalAlerts && <OperationalAlertsWidget recommendations={operationalAlerts} />}
        </section>

        <ActiveOrdersSection orders={activeOrders} />

        <section className={styles.panels} aria-label="Günlük iş takibi">
          <div className="flex min-w-0 flex-col gap-9">
            <TodayDeliveries deliveries={todayDeliveries} />
            {canQuotes && <WaitingApprovals approvals={waitingApprovals} />}
            {canAppointments && <TodayAppointments appointments={todayAppointments} />}
          </div>
          {canPhotos && <MissingPhotos items={missingPhotos} />}
        </section>

        {(canInventory || canCashbox || canReminders) && (
          <div className={styles.panels}>
            {canInventory && <CriticalStockWidget items={criticalStock} />}
            {canCashbox && <CashWidget data={{
              todayCollected: stats.todayCollected,
              openReceivable: stats.openReceivable,
              partialPayments: stats.partialPayments,
            }} />}
            {canInventory && canProcurement && <CriticalStockSuppliersWidget suppliers={criticalStockSuppliers} />}
            {canReminders && <ReminderWidget dueSoon={remindersDueSoon} overdue={remindersOverdue} />}
          </div>
        )}

        {weeklyOps && statusDist && (
          <section aria-label="Operasyon raporları" className={styles.panels}>
            <WeeklyChart data={weeklyOps} />
            <StatusChart data={statusDist} />
          </section>
        )}

        <div className={styles.panels}>
          <RecentCustomers customers={recentCustomers} />
          {canTeam && <TechnicianStatusWidget technicians={technicianOverview} unassignedCount={unassignedOrderCount} />}
        </div>
      </div>
    </AppShell>
  )
}
