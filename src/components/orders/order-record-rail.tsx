"use client"

import Link from "next/link"
import { StatusBadge, PaymentBadge } from "@/components/shared/status-badge"
import { formatTRY } from "@/lib/format"
import { formatFuelLevel } from "@/lib/fuel-level"
import { arrivalReasonLabel } from "@/lib/constants"
import { formatDate } from "@/lib/utils-client"
import type { OrderDetailData } from "@/components/orders/order-management-panel"

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[104px_minmax(0,1fr)] items-baseline gap-3 py-1.5 text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className="min-w-0 text-foreground">{children}</div>
    </div>
  )
}

/**
 * İş emri kaydının sol özellik listesi. Attio kayıt sayfasındaki
 * "Record Details" sütunu: etiket solda soluk, değer sağda, kart gölgesi yok.
 */
export function OrderRecordRail({
  order,
  customerName,
  showCashbox,
}: {
  order: OrderDetailData
  customerName: string
  showCashbox: boolean
}) {
  const vehicle = `${order.vehicle.brand} ${order.vehicle.model}${order.vehicle.modelYear ? ` (${order.vehicle.modelYear})` : ""}`
  const mileage = order.intake.mileageAtIntake ?? order.vehicle.mileage

  return (
    <aside className="border-b border-border pb-4 lg:border-b-0 lg:pb-0">
      <p className="mb-1 text-sm font-medium text-foreground">Kayıt detayı</p>
      <div className="divide-y divide-border/70">
        <Row label="Araç kabulü">
          <span className="font-medium">{order.workOrderNo}</span>
        </Row>
        <Row label="Durum">
          <StatusBadge status={order.status} size="sm" />
        </Row>
        {showCashbox && (
          <Row label="Ödeme">
            <PaymentBadge status={order.paymentStatus} size="sm" />
          </Row>
        )}
        <Row label="Müşteri">
          <Link href={`/customers/${order.customer.id}`} className="text-primary hover:underline">
            {customerName}
          </Link>
          {order.customer.type === "corporate" && order.customer.contactName ? (
            <p className="text-xs text-muted-foreground">Yetkili: {order.customer.contactName}</p>
          ) : null}
        </Row>
        <Row label="Telefon">
          <a href={`tel:${order.customer.phone}`} className="text-primary hover:underline">
            {order.customer.phone}
          </a>
        </Row>
        {order.customer.email ? (
          <Row label="E-posta">
            <a href={`mailto:${order.customer.email}`} className="break-all text-primary hover:underline">
              {order.customer.email}
            </a>
          </Row>
        ) : null}
        <Row label="Araç">
          <Link href={`/vehicles/${order.vehicle.id}`} className="text-primary hover:underline">
            {vehicle}
          </Link>
        </Row>
        <Row label="Plaka">
          <span className="font-medium">{order.vehicle.plate}</span>
        </Row>
        {mileage != null && (
          <Row label="Kilometre">{mileage.toLocaleString("tr-TR")} km</Row>
        )}
        {order.intake.fuelLevelAtIntake != null && (
          <Row label="Yakıt">{formatFuelLevel(order.intake.fuelLevelAtIntake)}</Row>
        )}
        {order.vehicle.vin ? (
          <Row label="Şase">
            <span className="font-mono text-xs">{order.vehicle.vin}</span>
          </Row>
        ) : null}
        {order.arrivalReason ? (
          <Row label="Geliş">{arrivalReasonLabel(order.arrivalReason)}</Row>
        ) : null}
        <Row label="Kabul">{formatDate(order.intake.createdAt)}</Row>
        {order.assignedTechnicianName || order.technicianName ? (
          <Row label="Usta">{order.assignedTechnicianName || order.technicianName}</Row>
        ) : null}
        {order.totals.hasAnyPrice && (
          <>
            <Row label="Toplam">
              <span className="font-medium tabular-nums">{formatTRY(order.totals.grandTotal)}</span>
            </Row>
            {showCashbox && (
              <Row label="Kalan">
                <span className={`font-medium tabular-nums ${order.remainingAmount > 0 ? "text-destructive-strong" : "text-success-strong"}`}>
                  {formatTRY(order.remainingAmount)}
                </span>
              </Row>
            )}
          </>
        )}
      </div>
    </aside>
  )
}
