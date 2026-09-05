import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/layout/app-shell"
import { FeaturePaywall } from "@/components/billing/feature-paywall"
import { InlineFeatureUpsell } from "@/components/billing/inline-feature-upsell"
import { prisma } from "@/lib/db"
import { quantityToNumber } from "@/lib/orders/quantity"
import Link from "next/link"
import { Search, Filter, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PurchasesList } from "@/components/purchases/purchases-list"
import { normalizePlate, trDateToDate } from "@/lib/format"
import { formatWorkOrderNo } from "@/lib/work-order-number"
import { isOrderLocked } from "@/lib/status-transitions"
import type { OrderStatus, Prisma } from "@prisma/client"
import { VISIBLE_PHOTO } from "@/lib/intake/photo-visibility"
import { getPlanState, hasWorkshopFeature } from "@/lib/plan"

export const dynamic = "force-dynamic"

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string }>
}) {
  const { user, workshop } = await getAppData()
  const canCreate = !!workshop && hasWorkshopFeature(workshop, "procurement")
  const currentTier = workshop ? getPlanState(workshop).tier : "lite"

  if (!canCreate) {
    const preservedCount = await prisma.serviceOrderItem.count({
      where: { workshopId: user.workshopId, source: "purchase" },
    })
    if (preservedCount === 0) {
      return <FeaturePaywall feature="procurement" currentTier={currentTier} itemCount={0} />
    }
  }

  const params = await searchParams
  const q = (params.q || "").trim()
  const from = (params.from || "").trim()
  const to = (params.to || "").trim()

  const fromDate = trDateToDate(from)
  const toDate = trDateToDate(to)
  // Bitiş tarihi gün sonuna kadar dahil.
  const toEnd = toDate ? new Date(toDate.getTime() + 24 * 60 * 60 * 1000 - 1) : null

  // Plakalar sıkıştırılmış (normalize) saklanır → boşluklu girdiyi de yakala.
  const plateQ = normalizePlate(q)
  const orClauses: Prisma.ServiceOrderItemWhereInput[] = q
    ? [
        { serviceOrder: { workOrderNo: { contains: q, mode: "insensitive" } } },
        { serviceOrder: { intakeForm: { vehicle: { plate: { contains: q, mode: "insensitive" } } } } },
        ...(plateQ && plateQ !== q
          ? [{ serviceOrder: { intakeForm: { vehicle: { plate: { contains: plateQ, mode: "insensitive" as const } } } } }]
          : []),
        { serviceOrder: { intakeForm: { vehicle: { vin: { contains: q, mode: "insensitive" } } } } },
        { supplierName: { contains: q, mode: "insensitive" } },
        { supplier: { name: { contains: q, mode: "insensitive" } } },
      ]
    : []

  const items = await prisma.serviceOrderItem.findMany({
    where: {
      workshopId: user.workshopId,
      source: "purchase",
      ...(fromDate || toEnd
        ? { purchasedAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toEnd ? { lte: toEnd } : {}) } }
        : {}),
      ...(q ? { OR: orClauses } : {}),
    },
    include: {
      serviceOrder: { include: { intakeForm: { include: { vehicle: true } } } },
      supplier: { select: { id: true, name: true } },
      purchasedBy: { select: { fullName: true } },
      photos: { where: VISIBLE_PHOTO, select: { id: true } },
    },
    orderBy: { purchasedAt: "desc" },
  })

  const rows = items.map((i) => ({
    id: i.id,
    orderId: i.serviceOrderId,
    workOrderNo: formatWorkOrderNo(i.serviceOrder),
    name: i.name,
    sku: i.sku,
    quantity: quantityToNumber(i.quantity),
    purchasePriceKurus: i.purchasePriceKurus,
    supplierName: i.supplierName || i.supplier?.name || null,
    purchasedByName: i.purchasedBy?.fullName ?? null,
    purchasedAt: i.purchasedAt ? i.purchasedAt.toISOString() : null,
    photoId: i.photos[0]?.id ?? null,
    orderLocked: isOrderLocked(i.serviceOrder.status as OrderStatus),
    vehicle: {
      id: i.serviceOrder.intakeForm.vehicle.id,
      plate: i.serviceOrder.intakeForm.vehicle.plate,
      vin: i.serviceOrder.intakeForm.vehicle.vin,
      brand: i.serviceOrder.intakeForm.vehicle.brand,
      model: i.serviceOrder.intakeForm.vehicle.model,
    },
  }))

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const kpis = {
    count: rows.length,
    totalKurus: rows.reduce((s, r) => s + Math.round((r.purchasePriceKurus ?? 0) * r.quantity), 0),
    supplierCount: new Set(rows.map((r) => (r.supplierName || "").toLowerCase()).filter(Boolean)).size,
    thisMonthCount: rows.filter((r) => r.purchasedAt && new Date(r.purchasedAt).getTime() >= monthStart).length,
  }

  const hasFilters = !!(q || from || to)

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Dış Alımlar" wide>
      <div className="space-y-5 sm:space-y-6">
        <div className="hidden sm:flex items-center text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground">Ana Panel</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">Dış Alımlar</span>
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Dış Alımlar</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Teknisyenlerin iş emrine dışarıdan aldığı parçalar</p>
        </div>

        {!canCreate && (
          <InlineFeatureUpsell feature="procurement" currentTier={currentTier} />
        )}

        <form action="/purchases" method="get" className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="İş emri no, plaka, şase veya tedarikçi ile ara..."
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Input name="from" defaultValue={from} placeholder="Başlangıç (gg.aa.yyyy)" className="w-40" />
            <Input name="to" defaultValue={to} placeholder="Bitiş (gg.aa.yyyy)" className="w-40" />
            <Button variant="outline" size="default" type="submit">
              <Filter className="size-4" />
              Filtrele
            </Button>
          </div>
        </form>

        {rows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ShoppingCart className="size-14 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-base font-medium">
              {hasFilters ? "Filtrelere uyan dış alım bulunamadı" : "Henüz dış alım kaydı yok"}
            </p>
            <p className="text-sm mt-1">
              {hasFilters
                ? "Farklı bir filtre deneyin"
                : "Teknisyenler mobil ekrandan “Parça Aldım” ile ekledikçe burada listelenir"}
            </p>
          </div>
        ) : (
          <PurchasesList rows={rows} kpis={kpis} />
        )}
      </div>
    </AppShell>
  )
}
