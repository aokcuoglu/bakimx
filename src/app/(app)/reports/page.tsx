import { getAppData } from "@/app/(app)/data"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { AppShell } from "@/components/layout/app-shell"
import { ReportsLayout } from "@/components/reports/reports-layout"
import { BarChart3 } from "lucide-react"

export default async function ReportsPage() {
  const paywall = await getFeaturePaywall("reports")
  if (paywall) return paywall
  const { workshop } = await getAppData()

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Raporlar">
      <ReportsLayout>
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="inline-flex size-16 items-center justify-center rounded-lg bg-primary/10 text-primary-strong">
              <BarChart3 className="size-8" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Raporlar</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Sol menüden bir rapor türü seçerek ayrıntılı raporları görüntüleyin.
            </p>
          </div>
        </div>
      </ReportsLayout>
    </AppShell>
  )
}
