import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { RecommendationsList } from "@/components/app/analytics/recommendations-list"
import { HealthScoreCard, HealthMetricCards } from "@/components/app/analytics/health-score-card"
import { DelayedJobsTable } from "@/components/app/analytics/delayed-jobs-table"
import { TechnicianAnalyticsSection } from "@/components/app/analytics/technician-analytics"
import { CustomerAnalyticsSection } from "@/components/app/analytics/customer-analytics"
import { PartsAnalyticsSection } from "@/components/app/analytics/parts-analytics"
import { RevenueAnalyticsSection } from "@/components/app/analytics/revenue-analytics"
import { ServiceAnalyticsSection } from "@/components/app/analytics/service-analytics"
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

export default async function AnalyticsPage() {
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
    <AppShell workshopName={workshop?.name} pageTitle="Operasyonel Analiz">
      <div className="space-y-6 max-w-full">
        <div className="rounded-2xl bg-gradient-to-br from-[#0B1F3A] to-[#0F172A] text-white p-5 sm:p-6 shadow-sm">
          <h2 className="text-xl sm:text-2xl font-bold">Operasyonel Analiz</h2>
          <p className="text-sm text-slate-300 mt-1">
            Atölyenizin operasyonel sağlığını ve performans metriklerini izleyin
          </p>
        </div>

        <div className="space-y-3">
          <RecommendationsList recommendations={recommendations} />
        </div>

        <section>
          <HealthScoreCard health={health} />
          <div className="mt-4">
            <HealthMetricCards health={health} />
          </div>
        </section>

        <section>
          <DelayedJobsTable jobs={delayedJobs} />
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-4">Teknisyen Analizi</h2>
          <TechnicianAnalyticsSection ranking={technicianRanking} />
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-4">Müşteri Analizi</h2>
          <CustomerAnalyticsSection analytics={customerAnalytics} />
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-4">Parça & Stok Analizi</h2>
          <PartsAnalyticsSection analytics={partsAnalytics} />
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-4">Gelir Analizi</h2>
          <RevenueAnalyticsSection analytics={revenueAnalytics} />
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-4">Servis Analizi</h2>
          <ServiceAnalyticsSection analytics={serviceAnalytics} />
        </section>
      </div>
    </AppShell>
  )
}