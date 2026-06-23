import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Plus, ClipboardList, Search, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { OrderList } from "@/components/app/order-list"
import { FilterSelect } from "@/components/app/filter-select"
import { formatWorkOrderNo } from "@/lib/work-order-number"
import { calculateOrderTotals } from "@/lib/totals"

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; payment?: string }>
}) {
  const params = await searchParams
  const q = (params.q || "").trim()
  const status = (params.status || "").trim()
  const payment = (params.payment || "").trim()

  const { user, workshop } = await getAppData()

  const [orders, statusGroups] = await Promise.all([
    prisma.serviceOrder.findMany({
      where: {
        workshopId: user.workshopId,
        ...(status ? { status: status as import("@prisma/client").OrderStatus } : {}),
        ...(payment ? { paymentStatus: payment as import("@prisma/client").PaymentStatus } : {}),
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

  const statusCountMap = new Map(statusGroups.map((g) => [g.status, g._count._all]))
  const activeStatuses = ["draft", "waiting_approval", "approved", "in_progress", "waiting_parts"]
  const kpis = {
    active: activeStatuses.reduce((s, st) => s + (statusCountMap.get(st as import("@prisma/client").OrderStatus) ?? 0), 0),
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
          <div className="flex gap-2">
            <FilterSelect
              name="status"
              defaultValue={status}
              placeholder="Tüm Durumlar"
              options={[
                { value: "", label: "Tüm Durumlar" },
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
              defaultValue={payment}
              placeholder="Tüm Ödemeler"
              options={[
                { value: "", label: "Tüm Ödemeler" },
                { value: "unpaid", label: "Ödenmedi" },
                { value: "partial", label: "Kısmi" },
                { value: "paid", label: "Ödendi" },
              ]}
            />
            <Button variant="outline" size="default" type="submit">
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
        />

        {orders.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <ClipboardList className="size-14 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-base font-medium">
              {q || status || payment
                ? "Filtrelere uyan iş emri bulunamadı"
                : "Henüz iş emri yok"}
            </p>
            <p className="text-sm mt-1">
              {q || status || payment
                ? "Farklı bir filtre deneyin"
                : "Yeni bir iş emri oluşturarak başlayabilirsiniz"}
            </p>
            <Button nativeButton={false} variant="link" size="sm" className="mt-4" render={<Link href="/orders/new" />}>
              <Plus className="size-4" />
              Yeni İş Emri
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  )
}
