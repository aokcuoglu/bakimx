"use client"

import Link from "next/link"

import { StatusBadge, PaymentBadge, PlateBadge } from "@/components/shared/status-badge"
import { ActionsMenu, MobileActionsMenu } from "@/components/shared/actions-menu"
import { StatCard } from "@/components/shared/stat-card"
import { TechnicianAssign, type AssignableTechnician } from "@/components/orders/technician-assign"
import { formatTRY } from "@/lib/format"
import { isOrderLocked } from "@/lib/status-transitions"
import type { OrderStatus } from "@prisma/client"

type OrderRow = {
  id: string
  workOrderNo: string
  status: string
  paymentStatus: string
  technicianName: string | null
  assignedTechnicianId: string | null
  assignedTechnicianName: string | null
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
  activeTechnician = "",
  technicians = [],
}: {
  orders: OrderRow[]
  kpis: KPIs
  activeStatus: string
  activePayment: string
  activeTechnician?: string
  technicians?: AssignableTechnician[]
}) {
  const kpiConfigs: KpiConfig[] = [
    { key: "active", label: "Aktif", count: kpis.active, filterValue: "draft", accent: "bg-primary/10 text-primary border-primary/20" },
    { key: "waitingApproval", label: "Onay Bekliyor", count: kpis.waitingApproval, filterValue: "waiting_approval", accent: "bg-warning/10 text-warning-strong border-warning/20" },
    { key: "completed", label: "Tamamlandı", count: kpis.completed, filterValue: "ready_for_delivery", accent: "bg-primary/10 text-primary border-primary/20" },
    { key: "delivered", label: "Teslim Edildi", count: kpis.delivered, filterValue: "delivered", accent: "bg-success/10 text-success-strong border-success/20" },
    { key: "cancelled", label: "İptal", count: kpis.cancelled, filterValue: "cancelled", accent: "bg-destructive/10 text-destructive-strong border-destructive/20" },
  ]

  // KPI kartına tıklamak yalnız durumu değiştirmeli; diğer aktif filtreler korunur.
  const keptFilters = [
    activePayment ? `payment=${activePayment}` : "",
    activeTechnician ? `technician=${encodeURIComponent(activeTechnician)}` : "",
  ].filter(Boolean)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {kpiConfigs.map((cfg) => {
          const isActive = activeStatus === cfg.filterValue
          const parts = isActive ? keptFilters : [`status=${cfg.filterValue}`, ...keptFilters]
          const href = parts.length > 0 ? `/orders?${parts.join("&")}` : "/orders"
          return (
            <StatCard
              key={cfg.key}
              label={cfg.label}
              value={cfg.count}
              accent={cfg.accent}
              href={href}
              active={isActive}
            />
          )
        })}
      </div>

      <div className="hidden lg:block rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead className="bg-muted border-b border-border text-muted-foreground text-xs uppercase tracking-wider sticky top-0 z-10">
              <tr>
                {/* İlişkili alanlar iki satırlı tek kolonda toplandı (11 -> 8):
                    plaka+araç, durum+ödeme, giriş+teslim. Bilgi kaybı yok,
                    tablo dar ekranlarda da yatay kaydırma gerektirmiyor. */}
                <th className="px-3 py-2 text-left font-semibold">İş No</th>
                <th className="px-3 py-2 text-left font-semibold">Araç</th>
                <th className="px-3 py-2 text-left font-semibold">Müşteri</th>
                <th className="px-3 py-2 text-left font-semibold">Teknisyen</th>
                <th className="px-3 py-2 text-left font-semibold">Durum</th>
                <th className="px-3 py-2 text-right font-semibold">Toplam</th>
                <th className="px-3 py-2 text-left font-semibold">Tarih</th>
                <th className="px-3 py-2 text-right font-semibold sticky right-0 border-l border-border bg-muted">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-muted/60 transition-colors group">
                  <td className="px-3 py-2 align-top">
                    <Link
                      href={`/orders/${order.id}`}
                      className="font-mono text-sm font-bold text-foreground hover:text-primary transition-colors"
                    >
                      {order.workOrderNo}
                    </Link>
                  </td>
                  <td className="px-3 py-2 align-top">
                    {/* Plaka ve marka/model tek kimlik bloğu: üstte plaka rozeti,
                        altında kırpılan marka/model. */}
                    <div className="max-w-[11rem]">
                      {order.vehicle.id ? (
                        <Link href={`/vehicles/${order.vehicle.id}`} className="opacity-60 hover:opacity-100 transition-opacity">
                          <PlateBadge plate={order.vehicle.plate} size="sm" />
                        </Link>
                      ) : (
                        <PlateBadge plate={order.vehicle.plate} size="sm" className="opacity-60" />
                      )}
                      <div
                        className="mt-1 text-[11px] leading-tight text-muted-foreground truncate"
                        title={`${order.vehicle.brand} ${order.vehicle.model}`}
                      >
                        {order.vehicle.brand} {order.vehicle.model}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    {/* Kurumsal unvanlar çok uzun olabiliyor; tam ad title ile erişilebilir kalır. */}
                    <div className="min-w-[10rem] max-w-[14rem]">
                      {order.customer.id ? (
                        <Link
                          href={`/customers/${order.customer.id}`}
                          title={customerName(order.customer)}
                          className="text-foreground font-medium hover:text-primary transition-colors block truncate"
                        >
                          {customerName(order.customer)}
                        </Link>
                      ) : (
                        <div className="text-foreground font-medium truncate" title={customerName(order.customer)}>
                          {customerName(order.customer)}
                        </div>
                      )}
                      <div className="text-[11px] leading-tight text-muted-foreground tabular-nums truncate">
                        {order.customer.phone}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top text-foreground">
                    <TechnicianAssign
                      orderId={order.id}
                      assignedTechnicianId={order.assignedTechnicianId}
                      assignedTechnicianName={order.assignedTechnicianName}
                      technicians={technicians}
                      locked={isOrderLocked(order.status as OrderStatus)}
                      size="sm"
                    />
                  </td>
                  <td className="px-3 py-2 align-top">
                    {/* İş durumu ve ödeme durumu aynı sütunda alt alta. */}
                    <div className="flex flex-col items-start gap-1">
                      <StatusBadge status={order.status} />
                      <PaymentBadge status={order.paymentStatus} />
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top text-right font-semibold text-foreground tabular-nums whitespace-nowrap">
                    {order.hasPrice ? formatTRY(order.grandTotal) : <span className="text-muted-foreground/70 font-normal">—</span>}
                  </td>
                  <td className="px-3 py-2 align-top text-xs whitespace-nowrap">
                    {/* Giriş üstte (her zaman dolu), tahmini teslim altta. */}
                    <div className="text-muted-foreground tabular-nums">
                      <span className="text-muted-foreground/70">Giriş</span> {formatDate(order.createdAt)}
                    </div>
                    <div className="mt-0.5 text-muted-foreground tabular-nums">
                      <span className="text-muted-foreground/70">Teslim</span>{" "}
                      {order.estimatedDeliveryAt ? formatDate(order.estimatedDeliveryAt) : <span className="text-muted-foreground/70">—</span>}
                    </div>
                  </td>
                  {/* Sticky kolonun zemini opak kalmalı: yarı saydam hover rengiyle
                      altından kayan içerik sızıp aksiyon butonuyla üst üste biniyordu. */}
                  <td className="px-3 py-2 align-top sticky right-0 border-l border-border bg-card group-hover:bg-[color-mix(in_oklab,var(--muted)_60%,var(--card))]">
                    <div className="flex items-center justify-end">
                      <ActionsMenu
                        viewHref={`/orders/${order.id}`}
                        // Teslim/iptal edilmiş emirde düzenleme kapalı → aksiyonu hiç gösterme.
                        editHref={
                          isOrderLocked(order.status as OrderStatus)
                            ? undefined
                            : `/orders/${order.id}?edit=1`
                        }
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
            className="rounded-lg border border-border bg-card p-3.5 hover:border-border transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/orders/${order.id}`}
                    className="font-mono text-sm font-bold text-foreground hover:text-primary transition-colors"
                  >
                    {order.workOrderNo}
                  </Link>
                  {order.vehicle.id ? (
                    <Link href={`/vehicles/${order.vehicle.id}`} className="opacity-60 hover:opacity-100 transition-opacity">
                      <PlateBadge plate={order.vehicle.plate} size="sm" />
                    </Link>
                  ) : (
                    <PlateBadge plate={order.vehicle.plate} size="sm" className="opacity-60" />
                  )}
                </div>
                <Link
                  href={order.customer.id ? `/customers/${order.customer.id}` : "#"}
                  className="mt-1.5 text-sm font-semibold text-foreground truncate block hover:text-primary transition-colors"
                >
                  {customerName(order.customer)}
                </Link>
                <p className="text-xs text-muted-foreground truncate">
                  {order.vehicle.brand} {order.vehicle.model}
                </p>
              </div>
              <MobileActionsMenu
                viewHref={`/orders/${order.id}`}
                editHref={
                  isOrderLocked(order.status as OrderStatus)
                    ? undefined
                    : `/orders/${order.id}?edit=1`
                }
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={order.status} />
              <PaymentBadge status={order.paymentStatus} />
              {/* Mobil kartta usta hiç görünmüyordu; rozet hem bilgi hem atama tetikleyicisi. */}
              <TechnicianAssign
                orderId={order.id}
                assignedTechnicianId={order.assignedTechnicianId}
                assignedTechnicianName={order.assignedTechnicianName}
                technicians={technicians}
                locked={isOrderLocked(order.status as OrderStatus)}
                size="sm"
              />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <div className="text-muted-foreground">
                {order.estimatedDeliveryAt ? (
                  <>Tahmini: <span className="text-foreground font-medium">{formatDate(order.estimatedDeliveryAt)}</span></>
                ) : (
                  <span>Giriş: {formatDate(order.createdAt)}</span>
                )}
              </div>
              <div className="font-semibold text-foreground">
                {order.hasPrice ? formatTRY(order.grandTotal) : <span className="text-muted-foreground/70 font-normal">—</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}