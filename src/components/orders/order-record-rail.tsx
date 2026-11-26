"use client"

import Link from "next/link"
import { DetailPanel, DetailRow as Row, detail } from "@/components/orders/order-detail-surface"
import { cn } from "@/lib/utils"
import { formatFuelLevel } from "@/lib/fuel-level"
import { formatDate } from "@/lib/utils-client"
import type { OrderDetailData } from "@/components/orders/order-management-panel"

/**
 * Müşteri ve araç kaydı. #911'den beri iki kolonda sağdaki yapışkan rayda,
 * tek kolonda (telefon) Özet bölümünde şikâyetin hemen altında durur. Kart
 * geniş kapsayıcıda "Araç Kabul Bilgileri" gibi iki sütuna bölünür (rayda tek
 * sütun).
 *
 * İş no, kabul tarihi, usta, geliş nedeni ve tutarlar burada YOK: ilk dördü
 * "Araç Kabul Bilgileri"nde, tutarlar başlığın altındaki şeritte. Durum ve
 * ödeme başlıktaki haplarda.
 */
export function OrderRecordRail({
  order,
  customerName,
}: {
  order: OrderDetailData
  customerName: string
}) {
  const vehicle = `${order.vehicle.brand} ${order.vehicle.model}${order.vehicle.modelYear ? ` (${order.vehicle.modelYear})` : ""}`
  const mileage = order.intake.mileageAtIntake ?? order.vehicle.mileage

  return (
    <DetailPanel title="Müşteri & Araç">
      <div className={detail.kvWrap}>
        <div className={detail.kvCols}>
          {/* SOL: müşteri ve iletişim */}
          <div>
            <Row label="Müşteri">
              <Link href={`/customers/${order.customer.id}`} className={cn(detail.hit, "text-primary hover:underline")}>
                {customerName}
              </Link>
              {order.customer.type === "corporate" && order.customer.contactName ? (
                <p className="text-xs text-muted-foreground">Yetkili: {order.customer.contactName}</p>
              ) : null}
            </Row>
            <Row label="Telefon">
              <a href={`tel:${order.customer.phone}`} className={cn(detail.hit, "text-primary hover:underline")}>
                {order.customer.phone}
              </a>
            </Row>
            {order.customer.email ? (
              <Row label="E-posta">
                <a href={`mailto:${order.customer.email}`} className={cn(detail.hit, "break-all text-primary hover:underline")}>
                  {order.customer.email}
                </a>
              </Row>
            ) : null}
            {order.intake.approvedAt ? <Row label="Müşteri onayı">{formatDate(order.intake.approvedAt)}</Row> : null}
          </div>
          {/* SAĞ: araç ve kabuldeki durumu */}
          <div>
            <Row label="Araç">
              <Link href={`/vehicles/${order.vehicle.id}`} className={cn(detail.hit, "text-primary hover:underline")}>
                {vehicle}
              </Link>
            </Row>
            {order.vehicle.vin ? (
              <Row label="Şase">
                <span className="font-mono text-sm">{order.vehicle.vin}</span>
              </Row>
            ) : null}
            {mileage != null && (
              <Row label="Kilometre">{mileage.toLocaleString("tr-TR")} km</Row>
            )}
            {order.intake.fuelLevelAtIntake != null && (
              <Row label="Yakıt">{formatFuelLevel(order.intake.fuelLevelAtIntake)}</Row>
            )}
          </div>
        </div>
      </div>
    </DetailPanel>
  )
}
