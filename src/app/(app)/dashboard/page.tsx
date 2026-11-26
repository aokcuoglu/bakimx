import { formatTodayTr } from "@/lib/format-date"
import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/layout/app-shell"
import Link from "next/link"
import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/button"
import styles from "@/components/dashboard/dashboard-layout.module.css"
import { getPlanState, hasFeature } from "@/lib/plan"
import { newIntakeHref } from "@/lib/intake/entry-links"

const DASHBOARD_INTAKE_HREF = newIntakeHref({ back: "/dashboard" })

import {
  getDashboardStats,
  getInServiceStatusCounts,
  getLongestInServiceOrders,
  getTodayDeliveries,
  getTodayAppointmentRows,
} from "@/lib/dashboard/queries"
import { countOverdueReminders } from "@/lib/reminders/queries"
import { getPartKPIs } from "@/lib/parts/queries"
import { getUnassignedOrderCount } from "@/lib/technician/queries"
import { getRecommendations } from "@/lib/analytics/queries"
import { KpiCards } from "@/components/dashboard/kpi-cards"
import { CashWidget } from "@/components/dashboard/cash-widget"
import { AlertBanner } from "@/components/dashboard/alert-banner"
import { TodayAgenda } from "@/components/dashboard/today-agenda"
import { LongestWaiting } from "@/components/dashboard/longest-waiting"
import { WorkshopStatus } from "@/components/dashboard/workshop-status"
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
  const canCashbox = hasFeature(accessTier, "cashbox")
  const canTeam = hasFeature(accessTier, "team")
  const canAnalytics = hasFeature(accessTier, "analytics")

  // Yönetici özeti: sayılar ve kısa listeler. Ayrıntı listeleri (eksik
  // fotoğraflar, onay bekleyenler, son müşteriler…) kendi sayfalarındadır;
  // burada yalnız "Dikkat gerektiren işler"de sayı olarak görünürler.
  //
  // Hepsi TEK Promise.all'da: birbirine bağımlı değiller. Öneriler eskiden bu
  // grubun ardından bekleniyordu ve kendi ~5 ardışık veritabanı gidiş-dönüşünü
  // sayfanın sonuna ekliyordu. Kazancın tavanı havuz boyutu (`pg` max 10):
  // yerel dev'de (tünel, ~80 ms/RTT) veri fazı 717 → 621 ms ölçüldü.
  const [
    stats,
    statusCounts,
    longestWaiting,
    todayDeliveries,
    todayAppointments,
    overdueReminders,
    partKpis,
    unassignedOrderCount,
    firstOrder,
    operationalAlerts,
  ] = await Promise.all([
    getDashboardStats(user.workshopId, {
      quotes: canQuotes,
      photoChecklist: canPhotos,
      cashbox: canCashbox,
    }),
    getInServiceStatusCounts(user.workshopId),
    getLongestInServiceOrders(user.workshopId, 5),
    getTodayDeliveries(user.workshopId),
    canAppointments ? getTodayAppointmentRows(user.workshopId) : Promise.resolve([]),
    canReminders ? countOverdueReminders(user.workshopId) : Promise.resolve(null),
    canInventory ? getPartKPIs(user.workshopId) : Promise.resolve(null),
    canTeam ? getUnassignedOrderCount(user.workshopId) : Promise.resolve(null),
    // "İlk işinize başlayın" kartı paketten bağımsız: henüz iş emri olmayan
    // her atölye görür (#830).
    prisma.serviceOrder.findFirst({ where: { workshopId: user.workshopId }, select: { id: true } }),
    canAnalytics ? getRecommendations(user.workshopId) : Promise.resolve(null),
  ])
  const needsFirstOrder = !firstOrder

  const greetingName = user.firstName || null
  const today = formatTodayTr(new Date())
  const subtitle = `${workshop?.name ?? "Genel Bakış"} · ${today}${greetingName ? ` · Hoş geldiniz, ${greetingName}` : ""}`

  return (
    <AppShell workshopName={workshop?.name} subtitle={subtitle}>
      <div className={surface.root}>
        {needsFirstOrder && (
          <DashPanel title="İlk adım" data-tour="first-order">
            <div className={surface.cardBody}>
              <h2 className="text-[22px] font-bold leading-7 tracking-[-0.025em]">İlk işinize başlayın</h2>
              <p className="mt-2 text-[17px] leading-6 text-muted-foreground">İlk müşterinizi ve aracınızı kaydedin, ardından araç kabulünüzü açın. Araç kabul ekranında da müşteri ve araç ekleyebilirsiniz.</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button asChild variant="outline"><Link href="/customers/new">İlk müşteriyi ekle</Link></Button>
                <Button variant="default" asChild><Link href={DASHBOARD_INTAKE_HREF}>İlk araç kabulünü oluştur</Link></Button>
              </div>
            </div>
          </DashPanel>
        )}

        <KpiCards stats={stats} showQuotes={canQuotes} />

        <section aria-label="Operasyon takibi" className={styles.panels}>
          <AlertBanner
            stats={stats}
            showQuotes={canQuotes}
            showPhotoChecklist={canPhotos}
            unassignedCount={unassignedOrderCount}
            stock={partKpis ? { outOfStock: partKpis.outOfStock, critical: partKpis.critical } : null}
            overdueReminders={overdueReminders}
          />
          {operationalAlerts && <OperationalAlertsWidget recommendations={operationalAlerts} />}
        </section>

        <section aria-label="Bugün" className={styles.panels}>
          <TodayAgenda deliveries={todayDeliveries} appointments={todayAppointments} />
          {canCashbox && (
            <CashWidget
              data={{
                todayCollected: stats.todayCollected,
                openReceivable: stats.openReceivable,
                partialPayments: stats.partialPayments,
              }}
            />
          )}
        </section>

        <section aria-label="Atölye" className={`${styles.panels} ${styles.panelsTop}`}>
          <LongestWaiting orders={longestWaiting} />
          <WorkshopStatus counts={statusCounts} />
        </section>
      </div>
    </AppShell>
  )
}
