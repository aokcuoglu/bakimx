import { getAppData } from "@/app/(app)/data"
import { type PlanTier } from "@/lib/plan"
import { resolveFeature } from "@/lib/features"
import { AppShell } from "@/components/layout/app-shell"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Plus, ClipboardList, Search, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { OrderList } from "@/components/orders/order-list"
import { FilterSelect } from "@/components/shared/filter-select"
import { StandaloneServiceAdvisor } from "@/components/advisor/standalone-service-advisor"
import { AdvisorPremiumLock } from "@/components/advisor/advisor-premium-lock"
import { formatWorkOrderNo } from "@/lib/work-order-number"
import { calculateOrderTotals } from "@/lib/totals"
import { getAssignableTechnicians } from "@/lib/technician/queries"
import { resolveTechnicianFilter, UNASSIGNED_TECHNICIAN } from "@/lib/orders/technician-filter"
import { INVOICE_WITH, INVOICE_WITHOUT, isInvoiceMissing, resolveInvoiceFilter } from "@/lib/orders/invoice-filter"
import { ACTIVE_ORDER_FILTER, ACTIVE_ORDER_STATUSES, resolveOrderStatusFilter } from "@/lib/orders/status-filter"

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    status?: string
    payment?: string
    technician?: string
    invoice?: string
  }>
}) {
  const params = await searchParams
  const q = (params.q || "").trim()
  const statusFilter = resolveOrderStatusFilter(params.status)
  const status = statusFilter.value
  const payment = (params.payment || "").trim()
  // Fatura filtresi statüden bağımsız, saf veri filtresi: "?invoice=with|without".
  const invoiceFilter = resolveInvoiceFilter(params.invoice)

  const { user, workshop } = await getAppData()
  const hasAiAdvisor = !!workshop && (await resolveFeature(workshop.id, workshop.planTier as PlanTier, "aiAdvisor"))

  // Usta filtresi, atölyenin kendi usta listesine karşı doğrulanır; client'tan
  // gelen ham id doğrudan sorguya girmez.
  const technicians = await getAssignableTechnicians(user.workshopId)
  const technicianFilter = resolveTechnicianFilter(
    params.technician,
    technicians.map((t) => t.id)
  )

  const [orders, statusGroups] = await Promise.all([
    prisma.serviceOrder.findMany({
      where: {
        workshopId: user.workshopId,
        ...statusFilter.where,
        ...(payment ? { paymentStatus: payment as import("@prisma/client").PaymentStatus } : {}),
        ...technicianFilter.where,
        ...invoiceFilter.where,
        ...(q
          ? {
              OR: [
                { workOrderNo: { contains: q, mode: "insensitive" as const } },
                { intakeForm: { vehicle: { plate: { contains: q, mode: "insensitive" as const } } } },
                { intakeForm: { customer: { firstName: { contains: q, mode: "insensitive" as const } } } },
                { intakeForm: { customer: { lastName: { contains: q, mode: "insensitive" as const } } } },
                { intakeForm: { customer: { phone: { contains: q } } } },
              ],
            }
          : {}),
      },
      include: {
        intakeForm: { include: { customer: true, vehicle: true } },
        items: true,
        assignedTechnician: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.serviceOrder.groupBy({
      by: ["status"],
      where: { workshopId: user.workshopId },
      _count: { _all: true },
    }),
  ])

  const hasAnyFilter = Boolean(q || status || payment || technicianFilter.value || invoiceFilter.value)

  const statusCountMap = new Map(statusGroups.map((g) => [g.status, g._count._all]))
  const kpis = {
    active: ACTIVE_ORDER_STATUSES.reduce((sum, itemStatus) => sum + (statusCountMap.get(itemStatus) ?? 0), 0),
    completed: statusCountMap.get("ready_for_delivery" as import("@prisma/client").OrderStatus) ?? 0,
    delivered: statusCountMap.get("delivered" as import("@prisma/client").OrderStatus) ?? 0,
    cancelled: statusCountMap.get("cancelled" as import("@prisma/client").OrderStatus) ?? 0,
    waitingApproval: statusCountMap.get("waiting_approval" as import("@prisma/client").OrderStatus) ?? 0,
  }

  const serializedOrders = orders.map((o) => {
    const totals = calculateOrderTotals(o.items, {
      discountAmount: o.discountAmount,
      taxRate: o.taxRate,
    })
    return {
      id: o.id,
      workOrderNo: formatWorkOrderNo(o),
      status: o.status,
      paymentStatus: o.paymentStatus,
      technicianName: o.technicianName,
      assignedTechnicianId: o.assignedTechnicianId,
      assignedTechnicianName: o.assignedTechnician?.fullName || null,
      estimatedDeliveryAt: o.estimatedDeliveryAt ? o.estimatedDeliveryAt.toISOString() : null,
      createdAt: o.createdAt.toISOString(),
      grandTotal: totals.grandTotal,
      itemsCount: o.items.length,
      hasPrice: totals.hasAnyPrice,
      invoiceNo: o.invoiceNo,
      invoiceMissing: isInvoiceMissing(o.status, o.invoiceNo),
      vehicle: {
        id: o.intakeForm.vehicle.id,
        plate: o.intakeForm.vehicle.plate,
        brand: o.intakeForm.vehicle.brand,
        model: o.intakeForm.vehicle.model,
      },
      customer: {
        id: o.intakeForm.customer.id,
        firstName: o.intakeForm.customer.firstName,
        lastName: o.intakeForm.customer.lastName,
        fullName: o.intakeForm.customer.fullName,
        companyName: o.intakeForm.customer.companyName,
        type: o.intakeForm.customer.type,
        phone: o.intakeForm.customer.phone,
      },
    }
  })

  return (
    <AppShell
      workshopName={workshop?.name}
      pageTitle="İş Emirleri"
      pageActions={
        <Button nativeButton={false} size="icon" render={<Link href="/orders/new" />} aria-label="Yeni iş emri">
          <Plus className="size-5" />
        </Button>
      }
    >
      <div className="space-y-5 sm:space-y-6">
        <div className="hidden sm:flex items-center text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground">Ana Panel</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">İş Emirleri</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">İş Emirleri</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Servis operasyonlarını yönetin</p>
          </div>
          <Button nativeButton={false} size="default" className="hidden sm:inline-flex" render={<Link href="/orders/new" />}>
            <Plus className="size-4" />
            Yeni İş Emri
          </Button>
        </div>

        <form action="/orders" method="get" className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="İş emri no, plaka veya müşteri adı ile ara..."
              className="pl-10"
            />
          </div>
          {/* Dört filtre dar ekranda 2'li ızgaraya düşüp geniş ekranda satıra
              dönüyor; seçimler anında uygulandığı için görünür buton yok. */}
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <FilterSelect
              name="status"
              autoSubmit
              className="w-full sm:w-auto"
              defaultValue={status}
              placeholder="Tüm Durumlar"
              options={[
                { value: "", label: "Tüm Durumlar" },
                { value: ACTIVE_ORDER_FILTER, label: "Aktif" },
                { value: "draft", label: "Taslak" },
                { value: "waiting_approval", label: "Onay Bekliyor" },
                { value: "approved", label: "Onaylandı" },
                { value: "in_progress", label: "Devam Ediyor" },
                { value: "waiting_parts", label: "Parça Bekliyor" },
                { value: "ready_for_delivery", label: "Teslime Hazır" },
                { value: "delivered", label: "Teslim Edildi" },
                { value: "cancelled", label: "İptal" },
              ]}
            />
            <FilterSelect
              name="payment"
              autoSubmit
              className="w-full sm:w-auto"
              defaultValue={payment}
              placeholder="Tüm Ödemeler"
              options={[
                { value: "", label: "Tüm Ödemeler" },
                { value: "unpaid", label: "Ödenmedi" },
                { value: "partial", label: "Kısmi ödeme" },
                { value: "paid", label: "Ödendi" },
              ]}
            />
            <FilterSelect
              name="technician"
              autoSubmit
              className="w-full sm:w-auto"
              defaultValue={technicianFilter.value}
              placeholder="Tüm Ustalar"
              options={[
                { value: "", label: "Tüm Ustalar" },
                { value: UNASSIGNED_TECHNICIAN, label: "Atanmamış" },
                ...technicians.map((t) => ({ value: t.id, label: t.fullName })),
              ]}
            />
            <FilterSelect
              name="invoice"
              autoSubmit
              className="w-full sm:w-auto"
              defaultValue={invoiceFilter.value}
              placeholder="Tüm Faturalar"
              options={[
                { value: "", label: "Tüm Faturalar" },
                { value: INVOICE_WITH, label: "Fatura kesildi" },
                { value: INVOICE_WITHOUT, label: "Fatura kesilmedi" },
              ]}
            />
            {/* Seçim kutuları anında uygular; düğme yalnız yedek. Metin araması
                Enter ile gönderilir (tek metin alanı olduğu için tarayıcı örtük
                submit yapar), JS yokken de bu düğme formu gönderir. */}
            <Button
              variant="outline"
              size="default"
              type="submit"
              className="sr-only focus:not-sr-only focus:w-full sm:focus:w-auto"
            >
              <Filter className="size-4" />
              Filtrele
            </Button>
          </div>
        </form>

        <OrderList
          orders={serializedOrders}
          kpis={kpis}
          activeStatus={status}
          activePayment={payment}
          activeTechnician={technicianFilter.value}
          activeInvoice={invoiceFilter.value}
          technicians={technicians}
        />

        {orders.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <ClipboardList className="size-14 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-base font-medium">
              {hasAnyFilter
                ? "Filtrelere uyan iş emri bulunamadı"
                : "Henüz iş emri yok"}
            </p>
            <p className="text-sm mt-1">
              {hasAnyFilter
                ? "Farklı bir filtre deneyin"
                : "Yeni bir iş emri oluşturarak başlayabilirsiniz"}
            </p>
            <Button nativeButton={false} variant="link" size="sm" className="mt-4" render={<Link href="/orders/new" />}>
              <Plus className="size-4" />
              Yeni İş Emri
            </Button>
          </div>
        )}

        {/* AI Servis Danışmanı — şikayetten önerilen iş kalemleri (Premium). */}
        {hasAiAdvisor ? <StandaloneServiceAdvisor /> : <AdvisorPremiumLock />}
      </div>
    </AppShell>
  )
}
