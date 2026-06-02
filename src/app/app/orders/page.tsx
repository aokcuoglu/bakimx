import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Plus, ClipboardList, Search, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { OrderList } from "@/components/app/order-list"
import { formatWorkOrderNo } from "@/lib/work-order-number"
import { calculateOrderTotals } from "@/lib/totals"

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; payment?: string }>
}) {
  const { user, workshop } = await getAppData()
  const params = await searchParams
  const q = (params.q || "").trim()
  const status = (params.status || "").trim()
  const payment = (params.payment || "").trim()

  const orders = await prisma.serviceOrder.findMany({
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
    },
    orderBy: { createdAt: "desc" },
  })

  const allOrders = await prisma.serviceOrder.findMany({
    where: { workshopId: user.workshopId },
    include: { items: true },
  })

  const kpis = {
    active: allOrders.filter((o) => ["draft", "waiting_approval", "approved", "in_progress", "waiting_parts"].includes(o.status)).length,
    completed: allOrders.filter((o) => o.status === "ready_for_delivery").length,
    delivered: allOrders.filter((o) => o.status === "delivered").length,
    cancelled: allOrders.filter((o) => o.status === "cancelled").length,
    waitingApproval: allOrders.filter((o) => o.status === "waiting_approval").length,
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
      estimatedDeliveryAt: o.estimatedDeliveryAt ? o.estimatedDeliveryAt.toISOString() : null,
      createdAt: o.createdAt.toISOString(),
      grandTotal: totals.grandTotal,
      itemsCount: o.items.length,
      hasPrice: totals.hasAnyPrice,
      vehicle: {
        plate: o.intakeForm.vehicle.plate,
        brand: o.intakeForm.vehicle.brand,
        model: o.intakeForm.vehicle.model,
      },
      customer: {
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
        <Link
          href="/app/orders/new"
          className="inline-flex items-center justify-center size-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white touch-manipulation"
          aria-label="Yeni iş emri"
        >
          <Plus className="size-5" />
        </Link>
      }
    >
      <div className="space-y-5 sm:space-y-6">
        <div className="hidden sm:flex items-center text-sm text-slate-500">
          <Link href="/app" className="hover:text-slate-700">Ana Panel</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700 font-medium">İş Emirleri</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">İş Emirleri</h2>
            <p className="text-sm text-slate-500 mt-0.5">Servis operasyonlarını yönetin</p>
          </div>
          <Link
            href="/app/orders/new"
            className="hidden sm:inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors touch-manipulation"
          >
            <Plus className="size-4" />
            Yeni İş Emri
          </Link>
        </div>

        <form action="/app/orders" method="get" className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="İş emri no, plaka veya müşteri adı ile ara..."
              className="pl-10 h-11"
            />
          </div>
          <div className="flex gap-2">
            <select
              name="status"
              defaultValue={status}
              className="h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              aria-label="Durum filtresi"
            >
              <option value="">Tüm Durumlar</option>
              <option value="draft">Taslak</option>
              <option value="waiting_approval">Onay Bekliyor</option>
              <option value="approved">Onaylandı</option>
              <option value="in_progress">Devam Ediyor</option>
              <option value="waiting_parts">Parça Bekliyor</option>
              <option value="ready_for_delivery">Teslime Hazır</option>
              <option value="delivered">Teslim Edildi</option>
              <option value="cancelled">İptal</option>
            </select>
            <select
              name="payment"
              defaultValue={payment}
              className="h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              aria-label="Ödeme filtresi"
            >
              <option value="">Tüm Ödemeler</option>
              <option value="unpaid">Ödenmedi</option>
              <option value="partial">Kısmi</option>
              <option value="paid">Ödendi</option>
            </select>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 h-11 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors touch-manipulation"
            >
              <Filter className="size-4" />
              Filtrele
            </button>
          </div>
        </form>

        <OrderList
          orders={serializedOrders}
          kpis={kpis}
          activeStatus={status}
          activePayment={payment}
        />

        {orders.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            <ClipboardList className="size-14 mx-auto mb-4 text-slate-300" />
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
            <Link
              href="/app/orders/new"
              className="inline-flex items-center gap-1.5 mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Plus className="size-4" />
              Yeni İş Emri
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  )
}
