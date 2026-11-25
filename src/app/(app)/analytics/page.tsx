import { getAppData } from "@/app/(app)/data"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { AppShell } from "@/components/layout/app-shell"
import { RecommendationsList } from "@/components/analytics/recommendations-list"
import { HealthScoreCard, HealthMetricCards } from "@/components/analytics/health-score-card"
import { DelayedJobsTable } from "@/components/analytics/delayed-jobs-table"
import { TechnicianAnalyticsSection } from "@/components/analytics/technician-analytics"
import { CustomerAnalyticsSection } from "@/components/analytics/customer-analytics"
import { PartsAnalyticsSection } from "@/components/analytics/parts-analytics"
import { RevenueAnalyticsSection } from "@/components/analytics/revenue-analytics"
import { ServiceAnalyticsSection } from "@/components/analytics/service-analytics"
import {
  getOperationsHealth,
  getDelayedJobs,
  getTechnicianAnalytics,
  getCustomerAnalytics,
  getPartsAnalytics,
  getRevenueAnalytics,
  getServiceAnalytics,
  getRecommendations,
} from "@/lib/analytics/queries"

export const metadata = { title: "Servis Analizi" }

export default async function AnalyticsPage() {
  const paywall = await getFeaturePaywall("analytics")
  if (paywall) return paywall
  const { user, workshop } = await getAppData()

  const [
    health,
    delayedJobs,
    technicianRanking,
    customerAnalytics,
    partsAnalytics,
    revenueAnalytics,
    serviceAnalytics,
    recommendations,
  ] = await Promise.all([
    getOperationsHealth(user.workshopId),
    getDelayedJobs(user.workshopId, 20),
    getTechnicianAnalytics(user.workshopId),
    getCustomerAnalytics(user.workshopId),
    getPartsAnalytics(user.workshopId),
    getRevenueAnalytics(user.workshopId),
    getServiceAnalytics(user.workshopId),
    getRecommendations(user.workshopId),
  ])

  return (
    <AppShell workshopName={workshop?.name}>
      <div className="min-w-0 space-y-6">
        <div className="space-y-3">
          <RecommendationsList recommendations={recommendations} />
        </div>

        <section className="min-w-0">
          <HealthScoreCard health={health} />
          <div className="mt-4">
            <HealthMetricCards health={health} />
          </div>
        </section>

        <section className="min-w-0">
          <DelayedJobsTable jobs={delayedJobs} />
        </section>

        <section className="min-w-0">
          <h2 className="text-base font-semibold text-foreground mb-3">Teknisyen Analizi</h2>
          <TechnicianAnalyticsSection ranking={technicianRanking} />
        </section>

        <section className="min-w-0">
          <h2 className="text-base font-semibold text-foreground mb-3">Müşteri Analizi</h2>
          <CustomerAnalyticsSection analytics={customerAnalytics} />
        </section>

        <section className="min-w-0">
          <h2 className="text-base font-semibold text-foreground mb-3">Parça & Stok Analizi</h2>
          <PartsAnalyticsSection analytics={partsAnalytics} />
        </section>

        <section className="min-w-0">
          <h2 className="text-base font-semibold text-foreground mb-3">Gelir Analizi</h2>
          <RevenueAnalyticsSection analytics={revenueAnalytics} />
        </section>

        <section className="min-w-0">
          <h2 className="text-base font-semibold text-foreground mb-3">Servis Analizi</h2>
          <ServiceAnalyticsSection analytics={serviceAnalytics} />
        </section>
      </div>
    </AppShell>
  )
}
