import Link from "next/link"
import { ArrowLeft, ChartNoAxesCombined } from "lucide-react"
import { SalesPerformanceDashboard } from "@/components/sales/sales-performance-dashboard"
import { Button } from "@/components/ui/button"
import { getSalesAccess } from "@/lib/sales/access"
import { loadSalesPerformance } from "@/lib/sales/performance-query"

export const dynamic = "force-dynamic"

export default async function SalesPerformancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[]; advisor?: string | string[] }>
}) {
  const access = await getSalesAccess("viewSales")
  const query = await searchParams
  const report = await loadSalesPerformance(access, {
    month: typeof query.month === "string" ? query.month : null,
    advisorId: typeof query.advisor === "string" ? query.advisor : null,
  })

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2">
          <Link href="/admin/sales"><ArrowLeft className="size-4" /> Satış merkezine dön</Link>
        </Button>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <ChartNoAxesCombined className="size-6 text-primary" /> Satış performansı
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Aylık hedefleri, gerçekleşen CRM aktivitelerini, net satış snapshot’larını ve hakedişleri karşılaştırın.
        </p>
      </div>
      <SalesPerformanceDashboard report={report} />
    </div>
  )
}
