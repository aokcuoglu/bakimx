"use client"

import Link from "next/link"
import { Eye, ChevronRight } from "lucide-react"
import { StatusBadge, PaymentBadge, PlateBadge } from "@/components/app/status-badge"
import { formatTRY } from "@/lib/format"
import { cn } from "@/lib/utils"

type OrderRow = {
  id: string
  workOrderNo: string
  status: string
  paymentStatus: string
  technicianName: string | null
  estimatedDeliveryAt: string | null
  createdAt: string
  grandTotal: number
  itemsCount: number
  hasPrice: boolean
  vehicle: { plate: string; brand: string; model: string }
  customer: {
    firstName: string | null
    lastName: string | null
    fullName: string | null
    companyName: string | null
    type: string
    phone: string
  }
}

type KPIs = {
  active: number
  completed: number
  delivered: number
  cancelled: number
  waitingApproval: number
}

type KpiConfig = {
  key: keyof KPIs
  label: string
  count: number
  status: string
  accent: string
}

const kpiBase: Omit<KpiConfig, "count" | "status">[] = [
  { key: "active", label: "Aktif", accent: "bg-blue-50 text-blue-700 border-blue-200" },
  { key: "completed", label: "Tamamlandı", accent: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { key: "delivered", label: "Teslim Edildi", accent: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { key: "cancelled", label: "İptal", accent: "bg-rose-50 text-rose-700 border-rose-200" },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function OrderList({
  orders,
  kpis,
  activeStatus,
  activePayment,
}: {
  orders: OrderRow[]
  kpis: KPIs
  activeStatus: string
  activePayment: string
}) {
  const kpiConfigs: KpiConfig[] = kpiBase.map((cfg) => ({
    ...cfg,
    count: kpis[cfg.key],
    status:
      cfg.key === "active"
        ? "draft"
        : cfg.key === "completed"
        ? "ready_for_delivery"
        : cfg.key === "delivered"
        ? "delivered"
        : "cancelled",
  }))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpiConfigs.map((cfg) => {
          const isActive = activeStatus === cfg.status
          const href = isActive
            ? `/app/orders${activePayment ? `?payment=${activePayment}` : ""}`
            : `/app/orders?status=${cfg.status}${activePayment ? `&payment=${activePayment}` : ""}`
          return (
            <Link
              key={cfg.key}
              href={href}
              className={cn(
                "rounded-xl border bg-white p-3 sm:p-4 transition-all hover:shadow-sm touch-manipulation",
                isActive ? "ring-2 ring-blue-500 border-blue-500" : "border-slate-200"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">{cfg.label}</span>
                <span className={cn("h-6 px-2 inline-flex items-center justify-center rounded-md border text-xs font-semibold", cfg.accent)}>
                  {cfg.count}
                </span>
              </div>
              <p className="mt-1 text-2xl font-bold text-slate-900">{cfg.count}</p>
            </Link>
          )
        })}
      </div>

      <div className="hidden lg:block rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">İş No</th>
                <th className="px-4 py-3 text-left font-semibold">Plaka / Araç</th>
                <th className="px-4 py-3 text-left font-semibold">Müşteri</th>
                <th className="px-4 py-3 text-left font-semibold">Teknisyen</th>
                <th className="px-4 py-3 text-left font-semibold">Durum</th>
                <th className="px-4 py-3 text-left font-semibold">Ödeme</th>
                <th className="px-4 py-3 text-right font-semibold">Toplam</th>
                <th className="px-4 py-3 text-left font-semibold">Giriş</th>
                <th className="px-4 py-3 text-left font-semibold">Tahmini Teslim</th>
                <th className="px-4 py-3 text-right font-semibold">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                    {order.workOrderNo}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      <PlateBadge plate={order.vehicle.plate} />
                      <span className="text-xs text-slate-500">
                        {order.vehicle.brand} {order.vehicle.model}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-900 font-medium">
                      {order.customer.type === "corporate"
                        ? order.customer.companyName || "Kurumsal Müşteri"
                        : order.customer.fullName || `${order.customer.firstName ?? ""} ${order.customer.lastName ?? ""}`.trim() || "Müşteri"}
                    </div>
                    <div className="text-xs text-slate-500">{order.customer.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {order.technicianName || <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3">
                    <PaymentBadge status={order.paymentStatus} />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {order.hasPrice ? formatTRY(order.grandTotal) : <span className="text-slate-400 font-normal">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {formatDate(order.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {order.estimatedDeliveryAt ? formatDate(order.estimatedDeliveryAt) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/app/orders/${order.id}`}
                        className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors touch-manipulation"
                      >
                        <Eye className="size-3.5" />
                        Görüntüle
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="lg:hidden space-y-2.5">
        {orders.map((order) => (
          <Link
            key={order.id}
            href={`/app/orders/${order.id}`}
            className="block rounded-xl border border-slate-200 bg-white p-3.5 active:bg-slate-50 touch-manipulation hover:border-slate-300 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-semibold text-slate-500">{order.workOrderNo}</span>
                  <PlateBadge plate={order.vehicle.plate} />
                </div>
                <p className="mt-1.5 text-sm font-semibold text-slate-900 truncate">
                  {order.customer.type === "corporate"
                    ? order.customer.companyName || "Kurumsal Müşteri"
                    : order.customer.fullName || `${order.customer.firstName ?? ""} ${order.customer.lastName ?? ""}`.trim() || "Müşteri"}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {order.vehicle.brand} {order.vehicle.model}
                </p>
              </div>
              <ChevronRight className="size-4 text-slate-400 shrink-0 mt-1" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={order.status} />
              <PaymentBadge status={order.paymentStatus} />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <div className="text-slate-500">
                {order.estimatedDeliveryAt ? (
                  <>Tahmini: <span className="text-slate-700 font-medium">{formatDate(order.estimatedDeliveryAt)}</span></>
                ) : (
                  <span>Giriş: {formatDate(order.createdAt)}</span>
                )}
              </div>
              <div className="font-semibold text-slate-900">
                {order.hasPrice ? formatTRY(order.grandTotal) : <span className="text-slate-400 font-normal">—</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
