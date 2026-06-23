import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/app/app-shell"
import { ReportsLayout } from "@/components/app/reports/reports-layout"
import { TechniciansReport } from "@/components/app/reports/technicians-report"
import { getTechnicianReportStats, getTechnicianPerformance } from "@/lib/reports/queries"
import { TECHNICIAN_ROLES } from "@/lib/constants"

export default async function TechniciansReportPage() {
  const { user, workshop } = await getAppData()
  const workshopId = user.workshopId

  const [stats, performance] = await Promise.all([
    getTechnicianReportStats(workshopId),
    getTechnicianPerformance(workshopId),
  ])

  const roleLabels: Record<string, string> = Object.fromEntries(
    Object.entries(TECHNICIAN_ROLES).map(([k, v]) => [k, v.label])
  )

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Teknisyen Raporu">
      <ReportsLayout>
        <TechniciansReport stats={stats} performance={performance} roleLabels={roleLabels} />
      </ReportsLayout>
    </AppShell>
  )
}