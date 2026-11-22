import Link from "next/link"
import { ArrowLeft, Camera } from "lucide-react"
import { AppShell } from "@/components/layout/app-shell"
import { SettingsPageHeader } from "@/components/settings/settings-page-header"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PhotoQuotaDialog } from "@/components/billing/photo-quota-dialog"
import { getAccountBillingContext } from "@/lib/billing/account-context"
import { prisma } from "@/lib/db"
import { MAX_ACTIVE_PHOTOS_PER_INTAKE } from "@/lib/photos/limits"
import { photoUsageWhere } from "@/lib/billing/photo-usage"

export const metadata = { title: "Kullanımlar" }

export default async function RecordUsagePage() {
  const { workshop, plan } = await getAccountBillingContext()
  const orders = await prisma.serviceOrder.findMany({
    where: { workshopId: workshop.id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 50,
    select: { id: true, intakeFormId: true, workOrderNo: true, createdAt: true },
  })
  const photoCounts = orders.length ? await prisma.vehiclePhoto.groupBy({
    by: ["intakeFormId"],
    where: photoUsageWhere(workshop.id, orders.map((order) => order.intakeFormId)),
    _count: { _all: true },
  }) : []
  const countByIntake = new Map(photoCounts.map((row) => [row.intakeFormId, row._count._all]))
  const limit = plan.accessTier === "lite" ? 0 : MAX_ACTIVE_PHOTOS_PER_INTAKE
  const used = orders.reduce((sum, order) => sum + (countByIntake.get(order.intakeFormId) ?? 0), 0)
  const capacity = orders.length * limit

  return (
    <AppShell pageTitle="Kullanımlar" workshopName={workshop.name}>
      <div className="mx-auto max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="mb-3"><Link href="/settings/billing"><ArrowLeft className="size-4" /> Faturalandırmaya dön</Link></Button>
      <SettingsPageHeader title="Kullanımlar" description="Araç kabullerinizdeki aktif fotoğraf hakkını ve kullanımını izleyin." />
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="flex items-center gap-2 text-xs text-muted-foreground"><Camera className="size-4" aria-hidden="true" /> Fotoğraf kullanımı</p><p className="mt-1 text-lg font-semibold">{used.toLocaleString("tr-TR")} <span className="text-sm font-normal text-muted-foreground">/ {capacity.toLocaleString("tr-TR")}</span></p></div>
            <PhotoQuotaDialog limit={limit} />
          </div>
          <div role="progressbar" aria-label="Listelenen araç kabullerinde fotoğraf kullanımı" aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={Math.min(used, capacity)} className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${capacity ? Math.min(100, used / capacity * 100) : 0}%` }} /></div>
          <p className="mt-2 text-xs text-muted-foreground">Son {orders.length} araç kabulü · silinmiş fotoğraflar sayılmaz · her araç kabulünün hakkı ayrıdır.</p>
        </div>
        {orders.length ? <div className="overflow-x-auto"><Table aria-label="Araç kabul fotoğraf kullanımı"><TableHeader><TableRow><TableHead>Araç kabulü</TableHead><TableHead>Tarih</TableHead><TableHead className="text-right">Kullanılan</TableHead><TableHead className="text-right">Kalan</TableHead></TableRow></TableHeader><TableBody>{orders.map((order) => { const count = countByIntake.get(order.intakeFormId) ?? 0; return <TableRow key={order.id}><TableCell><Link href={`/orders/${order.id}`} className="font-medium text-primary hover:underline">{order.workOrderNo || order.id.slice(0, 8)}</Link></TableCell><TableCell className="text-muted-foreground">{new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(order.createdAt)}</TableCell><TableCell className="text-right tabular-nums">{count} / {limit}</TableCell><TableCell className="text-right tabular-nums">{Math.max(0, limit - count)}</TableCell></TableRow> })}</TableBody></Table></div> : <p className="px-4 py-12 text-center text-sm text-muted-foreground">Henüz araç kabulü bulunmuyor.</p>}
      </div>
      </div>
    </AppShell>
  )
}
