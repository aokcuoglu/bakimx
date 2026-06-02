import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import Link from "next/link"
import {
  ClipboardList,
  Car,
  Users,
  Wrench,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Plus,
  Sparkles,
} from "lucide-react"
import { INTAKE_STATUS } from "@/lib/constants"
import { StatusBadge } from "@/components/app/status-badge"
import { formatTRY } from "@/lib/format"
import { formatWorkOrderNo } from "@/lib/work-order-number"
import { calculateOrderTotals } from "@/lib/totals"
import { formatDate } from "@/lib/utils-client"

export default async function DashboardPage() {
  const { user, workshop } = await getAppData()

  const [intakesCount, customersCount, vehiclesCount, recentIntakes, allOrders] = await Promise.all([
    prisma.vehicleIntakeForm.count({ where: { workshopId: user.workshopId } }),
    prisma.customer.count({ where: { workshopId: user.workshopId } }),
    prisma.vehicle.count({ where: { workshopId: user.workshopId } }),
    prisma.vehicleIntakeForm.findMany({
      where: { workshopId: user.workshopId },
      include: { customer: true, vehicle: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.serviceOrder.findMany({
      where: { workshopId: user.workshopId },
      include: { items: true, intakeForm: { include: { customer: true, vehicle: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ])

  const activeOrders = allOrders.filter((o) => !["delivered", "cancelled"].includes(o.status))
  const waitingApproval = allOrders.filter((o) => o.status === "waiting_approval").length + recentIntakes.filter((i) => i.status === "waiting_approval").length
  const recentOrders = allOrders.slice(0, 5)

  return (
    <AppShell
      workshopName={workshop?.name}
      pageTitle="Genel Bakış"
    >
      <div className="space-y-5 sm:space-y-6">
        <div className="rounded-2xl bg-gradient-to-br from-[#0B1F3A] to-[#0F172A] text-white p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold">
                Hoş Geldiniz, {user.firstName || user.email}
              </h2>
              <p className="text-sm text-slate-300 mt-1">
                {workshop?.name} • {new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            </div>
            <Link
              href="/app/orders/new"
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold transition-colors touch-manipulation shadow-sm"
            >
              <Plus className="size-4" />
              Yeni İş Emri
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Aktif İş Emri"
            value={activeOrders.length}
            icon={Wrench}
            accent="bg-blue-100 text-blue-700"
            href="/app/orders"
          />
          <KpiCard
            label="Toplam Müşteri"
            value={customersCount}
            icon={Users}
            accent="bg-indigo-100 text-indigo-700"
            href="/app/customers"
          />
          <KpiCard
            label="Toplam Araç"
            value={vehiclesCount}
            icon={Car}
            accent="bg-violet-100 text-violet-700"
            href="/app/vehicles"
          />
          <KpiCard
            label="Araç Kabul"
            value={intakesCount}
            icon={ClipboardList}
            accent="bg-slate-100 text-slate-700"
            href="/app/intakes"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {waitingApproval > 0 && (
            <Link
              href="/app/orders?status=waiting_approval"
              className="rounded-xl border border-amber-200 bg-amber-50 p-4 hover:bg-amber-100/60 transition-colors group"
            >
              <div className="flex items-center gap-2 text-amber-800 mb-1">
                <AlertCircle className="size-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Onay Bekleyen</span>
              </div>
              <p className="text-2xl font-bold text-amber-900">{waitingApproval}</p>
              <p className="text-xs text-amber-700 mt-1">İncelenmesi gereken kayıtlar</p>
              <ArrowRight className="size-4 text-amber-700 mt-2 group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
          <Link
            href="/app/orders?status=ready_for_delivery"
            className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 hover:bg-emerald-100/60 transition-colors group"
          >
            <div className="flex items-center gap-2 text-emerald-800 mb-1">
              <CheckCircle2 className="size-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Teslime Hazır</span>
            </div>
            <p className="text-2xl font-bold text-emerald-900">
              {allOrders.filter((o) => o.status === "ready_for_delivery").length}
            </p>
            <p className="text-xs text-emerald-700 mt-1">Müşteriye teslim edilmeyi bekleyen</p>
            <ArrowRight className="size-4 text-emerald-700 mt-2 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/app/intakes/new"
            className="rounded-xl border border-slate-200 bg-white p-4 hover:bg-slate-50 transition-colors group"
          >
            <div className="flex items-center gap-2 text-slate-700 mb-1">
              <Sparkles className="size-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Hızlı İşlem</span>
            </div>
            <p className="text-lg font-bold text-slate-900">Yeni Araç Kabulü</p>
            <p className="text-xs text-slate-600 mt-1">Yeni kabul oluşturup iş emri açın</p>
            <ArrowRight className="size-4 text-slate-700 mt-2 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-slate-900">Son İş Emirleri</h3>
              <Link href="/app/orders" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Tümü →
              </Link>
            </div>
            {recentOrders.length === 0 ? (
              <EmptyHint
                title="Henüz iş emri yok"
                description="Yeni bir iş emri oluşturarak başlayabilirsiniz."
                href="/app/orders/new"
                cta="Yeni İş Emri"
              />
            ) : (
              <div className="space-y-2">
                {recentOrders.map((order) => {
                  const totals = calculateOrderTotals(order.items, {
                    discountAmount: order.discountAmount,
                    taxRate: order.taxRate,
                  })
                  return (
                    <Link
                      key={order.id}
                      href={`/app/orders/${order.id}`}
                      className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="size-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                          <Wrench className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {formatWorkOrderNo(order)} • {order.intakeForm.vehicle.plate}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {order.intakeForm.customer.type === "corporate"
                              ? order.intakeForm.customer.companyName || "Kurumsal Müşteri"
                              : order.intakeForm.customer.fullName || `${order.intakeForm.customer.firstName ?? ""} ${order.intakeForm.customer.lastName ?? ""}`.trim() || "Müşteri"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <StatusBadge status={order.status} />
                        {totals.hasAnyPrice && (
                          <p className="text-xs font-semibold text-slate-900 mt-1.5">{formatTRY(totals.grandTotal)}</p>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-slate-900">Son Kabuller</h3>
              <Link href="/app/intakes" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                Tümü →
              </Link>
            </div>
            {recentIntakes.length === 0 ? (
              <EmptyHint
                title="Henüz kabul kaydı yok"
                description="İlk kabul formunuzu oluşturun."
                href="/app/intakes/new"
                cta="Yeni Kabul"
              />
            ) : (
              <div className="space-y-2">
                {recentIntakes.map((intake) => {
                  const statusInfo = INTAKE_STATUS[intake.status as keyof typeof INTAKE_STATUS]
                  return (
                    <Link
                      key={intake.id}
                      href={`/app/intakes/${intake.id}`}
                      className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="size-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                          <Car className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {intake.vehicle.plate} • {intake.customer.type === "corporate"
                              ? intake.customer.companyName || "Kurumsal Müşteri"
                              : intake.customer.fullName || `${intake.customer.firstName ?? ""} ${intake.customer.lastName ?? ""}`.trim() || "Müşteri"}
                          </p>
                          <p className="text-xs text-slate-500 truncate">
                            {intake.vehicle.brand} {intake.vehicle.model} • {formatDate(intake.createdAt)}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ml-2 ${statusInfo?.color || "bg-slate-100 text-slate-700"}`}>
                        {statusInfo?.label || intake.status}
                      </span>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  href,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  accent: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-sm transition-all"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-500 font-medium">{label}</span>
        <div className={`size-8 rounded-lg ${accent} flex items-center justify-center`}>
          <Icon className="size-4" />
        </div>
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </Link>
  )
}

function EmptyHint({
  title,
  description,
  href,
  cta,
}: {
  title: string
  description: string
  href: string
  cta: string
}) {
  return (
    <div className="text-center py-10 px-4 bg-white border border-dashed border-slate-200 rounded-xl">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="text-xs text-slate-500 mt-1">{description}</p>
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        <Plus className="size-3.5" />
        {cta}
      </Link>
    </div>
  )
}
