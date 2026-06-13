import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { ReportsLayout } from "@/components/app/reports/reports-layout"
import { BarChart3 } from "lucide-react"

export default async function ReportsPage() {
  const { workshop } = await getAppData()

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Raporlar">
      <ReportsLayout>
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <BarChart3 className="size-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Raporlar</h3>
            <p className="text-sm text-slate-500 max-w-sm">
              Sol menüden bir rapor türü seçerek ayrıntılı raporları görüntüleyin.
            </p>
          </div>
        </div>
      </ReportsLayout>
    </AppShell>
  )
}