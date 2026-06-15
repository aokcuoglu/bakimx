"use client"

import Link from "next/link"

import { StatusBadge, PaymentBadge, PlateBadge } from "@/components/app/status-badge"
import { ActionsMenu, MobileActionsMenu } from "@/components/app/actions-menu"
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
  vehicle: { plate: string; brand: string; model: string; id?: string }
  customer: {
    id?: string
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
  filterValue: string
  accent: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function customerName(c: OrderRow["customer"]): string {
  if (c.type === "corporate") return c.companyName || "Kurumsal Müşteri"
  return c.fullName || `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || "Müşteri"
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
  const kpiConfigs: KpiConfig[] = [
    { key: "active", label: "Aktif", count: kpis.active, filterValue: "draft", accent: "bg-blue-50 text-blue-700 border-blue-200" },
    { key: "waitingApproval", label: "Onay Bekliyor", count: kpis.waitingApproval, filterValue: "waiting_approval", accent: "bg-amber-50 text-amber-700 border-amber-200" },
    { key: "completed", label: "Tamamlandı", count: kpis.completed, filterValue: "ready_for_delivery", accent: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    { key: "delivered", label: "Teslim Edildi", count: kpis.delivered, filterValue: "delivered", accent: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { key: "cancelled", label: "İptal", count: kpis.cancelled, filterValue: "cancelled", accent: "bg-rose-50 text-rose-700 border-rose-200" },
  ]

  const paymentParam = activePayment ? `&payment=${activePayment}` : ""

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {kpiConfigs.map((cfg) => {
          const isActive = activeStatus === cfg.filterValue
          const href = isActive
            ? `/app/orders${paymentParam ? `?payment=${activePayment}` : ""}`
            : `/app/orders?status=${cfg.filterValue}${paymentParam}`
          return (
            <Link
              key={cfg.key}
              href={href}
              prefetch={false}
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
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider sticky top-0 z-10">
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
                <th className="px-4 py-3 text-right font-semibold sticky right-0 bg-slate-50">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/60 transition-colors group">
                  <td className="px-4 py-3">
                    <Link
                      href={`/app/orders/${order.id}`}
                      className="font-mono text-xs font-semibold text-slate-700 hover:text-blue-600 transition-colors"
                    >
                      {order.workOrderNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      {order.vehicle.id ? (
                        <Link href={`/app/vehicles/${order.vehicle.id}`}>
                          <PlateBadge plate={order.vehicle.plate} />
                        </Link>
                      ) : (
                        <PlateBadge plate={order.vehicle.plate} />
                      )}
                      <span className="text-xs text-slate-500">
                        {order.vehicle.brand} {order.vehicle.model}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {order.customer.id ? (
                      <Link
                        href={`/app/customers/${order.customer.id}`}
                        className="text-slate-900 font-medium hover:text-blue-600 transition-colors block"
                      >
                        {customerName(order.customer)}
                      </Link>
                    ) : (
                      <div className="text-slate-900 font-medium">{customerName(order.customer)}</div>
                    )}
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
                  <td className="px-4 py-3 sticky right-0 bg-white group-hover:bg-slate-50/60">
                    <div className="flex items-center justify-end">
                      <ActionsMenu
                        viewHref={`/app/orders/${order.id}`}
                        editHref={`/app/orders/${order.id}?edit=1`}
                      />
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
          <div
            key={order.id}
            className="rounded-xl border border-slate-200 bg-white p-3.5 hover:border-slate-300 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/app/orders/${order.id}`}
                    className="font-mono text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors"
                  >
                    {order.workOrderNo}
                  </Link>
                  {order.vehicle.id ? (
                    <Link href={`/app/vehicles/${order.vehicle.id}`}>
                      <PlateBadge plate={order.vehicle.plate} />
                    </Link>
                  ) : (
                    <PlateBadge plate={order.vehicle.plate} />
                  )}
                </div>
                <Link
                  href={order.customer.id ? `/app/customers/${order.customer.id}` : "#"}
                  className="mt-1.5 text-sm font-semibold text-slate-900 truncate block hover:text-blue-600 transition-colors"
                >
                  {customerName(order.customer)}
                </Link>
                <p className="text-xs text-slate-500 truncate">
                  {order.vehicle.brand} {order.vehicle.model}
                </p>
              </div>
              <MobileActionsMenu
                viewHref={`/app/orders/${order.id}`}
                editHref={`/app/orders/${order.id}?edit=1`}
              />
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
          </div>
        ))}
      </div>
    </div>
  )
}