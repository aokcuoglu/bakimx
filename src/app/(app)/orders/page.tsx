import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/layout/app-shell"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Plus, ClipboardList, Filter, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { OrderList } from "@/components/orders/order-list"
import { FilterSelect } from "@/components/shared/filter-select"
import { OrderFiltersDisclosure } from "@/components/orders/order-filters-disclosure"
import { surface } from "@/components/dashboard/surface"
import { formatWorkOrderNo } from "@/lib/work-order-number"
import { calculateOrderTotals } from "@/lib/totals"
import { currentWorkOrderCustomer } from "@/lib/orders/current-customer"
import { getAssignableTechnicians } from "@/lib/technician/queries"
import { resolveTechnicianFilter, UNASSIGNED_TECHNICIAN } from "@/lib/orders/technician-filter"
import { INVOICE_WITH, INVOICE_WITHOUT, isInvoiceMissing, resolveInvoiceFilter } from "@/lib/orders/invoice-filter"
import { ACTIVE_ORDER_FILTER, ACTIVE_ORDER_STATUSES, IN_SERVICE_ORDER_FILTER, resolveOrderStatusFilter } from "@/lib/orders/status-filter"
import { DELIVERY_OVERDUE, DELIVERY_TODAY, resolveDeliveryFilter } from "@/lib/orders/delivery-filter"

export const metadata = { title: "Araç Kabulleri" }

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    status?: string
    payment?: string
    technician?: string
    invoice?: string
    delivery?: string
  }>
}) {
  const params = await searchParams
  const q = (params.q || "").trim()
  const statusFilter = resolveOrderStatusFilter(params.status)
  const status = statusFilter.value
  const payment = (params.payment || "").trim()
  // Fatura filtresi statüden bağımsız, saf veri filtresi: "?invoice=with|without".
  const invoiceFilter = resolveInvoiceFilter(params.invoice)
  // Teslim tarihi filtresi: "?delivery=today|overdue" — Genel Bakış'taki
  // "Bugün teslim" / "Geciken teslim" kartları buraya gelir.
  const deliveryFilter = resolveDeliveryFilter(params.delivery)

  const { user, workshop } = await getAppData()
  // Usta filtresi, atölyenin kendi usta listesine karşı doğrulanır; client'tan
  // gelen ham id doğrudan sorguya girmez.
  const technicians = await getAssignableTechnicians(user.workshopId)
  const technicianFilter = resolveTechnicianFilter(
    params.technician,
    technicians.map((t) => t.id)
  )

  const [orders, statusGroups] = await Promise.all([
    prisma.serviceOrder.findMany({
      // Filtre parçaları yayılmak yerine AND'le birleşir: birden çoğu aynı
      // anahtarı kullanıyor (durum + teslim → `status`, fatura yok + arama →
      // `OR`) ve yayınca sonraki öncekini sessizce ezerdi.
      where: {
        workshopId: user.workshopId,
        AND: [
          statusFilter.where,
          payment ? { paymentStatus: payment as import("@prisma/client").PaymentStatus } : {},
          technicianFilter.where,
          invoiceFilter.where,
          deliveryFilter.where,
          q
          ? {
              OR: [
                { workOrderNo: { contains: q, mode: "insensitive" as const } },
                { intakeForm: { vehicle: { plate: { contains: q, mode: "insensitive" as const } } } },
                { intakeForm: { vehicle: { customer: { firstName: { contains: q, mode: "insensitive" as const } } } } },
                { intakeForm: { vehicle: { customer: { lastName: { contains: q, mode: "insensitive" as const } } } } },
                { intakeForm: { vehicle: { customer: { phone: { contains: q } } } } },
              ],
            }
          : {},
        ],
      },
      include: {
        intakeForm: { include: { customer: true, vehicle: { include: { customer: true } } } },
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

  const activeFilterCount = [status, payment, technicianFilter.value, invoiceFilter.value, deliveryFilter.value].filter(Boolean).length
  const hasAnyFilter = Boolean(q || status || payment || technicianFilter.value || invoiceFilter.value || deliveryFilter.value)

  const statusCountMap = new Map(statusGroups.map((g) => [g.status, g._count._all]))
  const kpis = {
    active: ACTIVE_ORDER_STATUSES.reduce((sum, itemStatus) => sum + (statusCountMap.get(itemStatus) ?? 0), 0),
    completed: statusCountMap.get("ready_for_delivery" as import("@prisma/client").OrderStatus) ?? 0,
    delivered: statusCountMap.get("delivered" as import("@prisma/client").OrderStatus) ?? 0,
    cancelled: statusCountMap.get("cancelled" as import("@prisma/client").OrderStatus) ?? 0,
    waitingApproval: statusCountMap.get("waiting_approval" as import("@prisma/client").OrderStatus) ?? 0,
  }

  const serializedOrders = orders.map((o) => {
    const currentCustomer = currentWorkOrderCustomer(o.intakeForm)
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
        id: currentCustomer.id,
        firstName: currentCustomer.firstName,
        lastName: currentCustomer.lastName,
        fullName: currentCustomer.fullName,
        companyName: currentCustomer.companyName,
        type: currentCustomer.type,
        phone: currentCustomer.phone,
      },
    }
  })

  return (
    <AppShell
      workshopName={workshop?.name}
      pageTitle="Araç Kabulleri"
    >
      <div className="space-y-5 sm:space-y-6">
        {/* Genel Bakış kalıbı: başlık + birincil eylem aynı satırda (dashboard
            hero'sunun aynı sınıfları). Kabuk bu sayfada başlık çizmez
            (app-shell CONTENT_H1_PATHS). */}
        <section className={surface.hero}>
          <h1 className={surface.heroTitle}>Araç Kabulleri</h1>
          <Button variant="default" className={surface.heroCta} asChild>
            <Link href="/orders/new">
              <Plus className="size-4" />
              Yeni Araç Kabul
            </Link>
          </Button>
        </section>
        <OrderList
          orders={serializedOrders}
          kpis={kpis}
          activeStatus={status}
          activePayment={payment}
          activeTechnician={technicianFilter.value}
          activeInvoice={invoiceFilter.value}
          activeDelivery={deliveryFilter.value}
          technicians={technicians}
          searchQuery={q}
          toolbar={
            // Sabit anahtar: anahtarsız hâliyle OrderList'te React "unique key"
            // uyarısı veriyordu (#717; e2e/order-list-keys.e2e.ts). `key={q}`
            // kullanılamaz — her aramada formu yeniden kurup yazarken odağı
            // düşürür (#724).
            <form key="order-list-filters" id="order-list-filters" action="/orders" method="get" className="space-y-3">
              {/* Arama boydan boya (sidebar arama kutusu gibi dolgulu); filtreler
                  varsayılan kapalı, kutudaki "Filtreler" düğmesi açar. */}
              <OrderFiltersDisclosure
                activeCount={activeFilterCount}
                search={
                  <Input
                    name="q"
                    defaultValue={q}
                    placeholder="Araç kabulü, plaka veya müşteri ara…"
                    aria-label="Araç kabulü ara"
                    className="h-11 rounded-xl border-0 bg-foreground/[0.06] pl-10 pr-36 text-[17px] shadow-none md:h-10 md:text-[15px]"
                  />
                }
              >
              {/* Filtreler dar ekranda 2'li ızgaraya düşüp geniş ekranda satıra
                  dönüyor; seçimler anında uygulandığı için görünür buton yok. */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
                <FilterSelect
                  name="status"
                  autoSubmit
                  singleLine
                  className="h-11 w-full rounded-full border-0 bg-foreground/[0.06] px-4 text-[15px] shadow-none hover:bg-foreground/[0.09] sm:w-auto md:h-9"
                  defaultValue={status}
                  placeholder="Tüm Durumlar"
                  options={[
                    { value: "", label: "Tüm Durumlar" },
                    { value: IN_SERVICE_ORDER_FILTER, label: "Serviste" },
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
                  singleLine
                  className="h-11 w-full rounded-full border-0 bg-foreground/[0.06] px-4 text-[15px] shadow-none hover:bg-foreground/[0.09] sm:w-auto md:h-9"
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
                  singleLine
                  className="h-11 w-full rounded-full border-0 bg-foreground/[0.06] px-4 text-[15px] shadow-none hover:bg-foreground/[0.09] sm:w-auto md:h-9"
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
                  singleLine
                  className="h-11 w-full rounded-full border-0 bg-foreground/[0.06] px-4 text-[15px] shadow-none hover:bg-foreground/[0.09] sm:w-auto md:h-9"
                  defaultValue={invoiceFilter.value}
                  placeholder="Tüm Faturalar"
                  options={[
                    { value: "", label: "Tüm Faturalar" },
                    { value: INVOICE_WITH, label: "Fatura kesildi" },
                    { value: INVOICE_WITHOUT, label: "Fatura kesilmedi" },
                  ]}
                />
                <FilterSelect
                  name="delivery"
                  autoSubmit
                  singleLine
                  className="col-span-2 sm:col-span-1 h-11 w-full rounded-full border-0 bg-foreground/[0.06] px-4 text-[15px] shadow-none hover:bg-foreground/[0.09] sm:w-auto md:h-9"
                  defaultValue={deliveryFilter.value}
                  placeholder="Tüm Teslimler"
                  options={[
                    { value: "", label: "Tüm Teslimler" },
                    { value: DELIVERY_TODAY, label: "Bugün teslim" },
                    { value: DELIVERY_OVERDUE, label: "Geciken teslim" },
                  ]}
                />
                </div>
                {hasAnyFilter && (
                  <Button variant="ghost" size="sm" className="rounded-full" asChild>
                    <Link href="/orders"><X className="size-3.5" />Temizle</Link>
                  </Button>
                )}
                {/* Arama yazarken, seçimler değişince uygulanır. Enter ve bu
                    düğme JS yokken de formu gönderen yedeklerdir. */}
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
              </OrderFiltersDisclosure>
            </form>
          }
          emptyState={
            <div key="order-list-empty" className="px-4 py-12 text-center text-muted-foreground">
              <ClipboardList className="size-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-base font-medium">
                {hasAnyFilter
                  ? "Filtrelere uyan araç kabulü bulunamadı"
                  : "Henüz araç kabulü yok"}
              </p>
              <p className="text-sm mt-1">
                {hasAnyFilter
                  ? "Farklı bir filtre deneyin"
                  : "Yeni bir araç kabulü oluşturarak başlayabilirsiniz"}
              </p>
              <Button variant={hasAnyFilter ? "outline" : "foreground"} size="sm" className="mt-4" asChild>
                <Link href={hasAnyFilter ? "/orders" : "/orders/new"}>
                  {hasAnyFilter ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
                  {hasAnyFilter ? "Filtreleri temizle" : "Yeni Araç Kabul"}
                </Link>
              </Button>
            </div>
          }
        />

      </div>
    </AppShell>
  )
}
