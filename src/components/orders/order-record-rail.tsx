"use client";

import Link from "next/link";
import {
  DetailPanel,
  DetailRow as Row,
} from "@/components/orders/order-detail-surface";
import { formatTRY } from "@/lib/format";
import { formatFuelLevel } from "@/lib/fuel-level";
import { arrivalReasonLabel } from "@/lib/constants";
import { formatDate } from "@/lib/utils-client";
import type { OrderDetailData } from "@/components/orders/order-management-panel";

/**
 * İş emri kaydının özellik paneli: beyaz kart, etiket solda soluk, değer
 * sağda. Durum/ödeme başlıkta olduğundan burada tekrarlanmaz. Masaüstünde sol
 * sütun, dar ekranda Özet'in ilk paneli.
 */
export function OrderRecordRail({
  order,
  customerName,
  showCashbox,
  className,
}: {
  order: OrderDetailData;
  customerName: string;
  showCashbox: boolean;
  className?: string;
}) {
  const vehicle = `${order.vehicle.brand} ${order.vehicle.model}${order.vehicle.modelYear ? ` (${order.vehicle.modelYear})` : ""}`;
  const mileage = order.intake.mileageAtIntake ?? order.vehicle.mileage;

  return (
    <div className={className}>
      <DetailPanel title="Kayıt">
        <Row label="Araç kabulü">
          <span className="font-medium">{order.workOrderNo}</span>
        </Row>
        <Row label="Müşteri">
          <Link
            href={`/customers/${order.customer.id}`}
            className="text-primary hover:underline"
          >
            {customerName}
          </Link>
          {order.customer.type === "corporate" && order.customer.contactName ? (
            <p className="text-xs text-muted-foreground">
              Yetkili: {order.customer.contactName}
            </p>
          ) : null}
        </Row>
        <Row label="Telefon">
          <a
            href={`tel:${order.customer.phone}`}
            className="text-primary hover:underline"
          >
            {order.customer.phone}
          </a>
        </Row>
        {order.customer.email ? (
          <Row label="E-posta">
            <a
              href={`mailto:${order.customer.email}`}
              className="break-all text-primary hover:underline"
            >
              {order.customer.email}
            </a>
          </Row>
        ) : null}
        <Row label="Araç">
          <Link
            href={`/vehicles/${order.vehicle.id}`}
            className="text-primary hover:underline"
          >
            {vehicle}
          </Link>
        </Row>
        {mileage != null && (
          <Row label="Kilometre">{mileage.toLocaleString("tr-TR")} km</Row>
        )}
        {order.intake.fuelLevelAtIntake != null && (
          <Row label="Yakıt">
            {formatFuelLevel(order.intake.fuelLevelAtIntake)}
          </Row>
        )}
        {order.vehicle.vin ? (
          <Row label="Şase">
            <span className="font-mono text-sm">{order.vehicle.vin}</span>
          </Row>
        ) : null}
        {order.arrivalReason ? (
          <Row label="Geliş">{arrivalReasonLabel(order.arrivalReason)}</Row>
        ) : null}
        <Row label="Kabul">{formatDate(order.intake.createdAt)}</Row>
        {order.intake.approvedAt ? (
          <Row label="Onay">{formatDate(order.intake.approvedAt)}</Row>
        ) : null}
        {order.assignedTechnicianName || order.technicianName ? (
          <Row label="Usta">
            {order.assignedTechnicianName || order.technicianName}
          </Row>
        ) : null}
        {order.totals.hasAnyPrice && (
          <>
            <Row label="Toplam">
              <span className="font-medium tabular-nums">
                {formatTRY(order.totals.grandTotal)}
              </span>
            </Row>
            {showCashbox && (
              <Row label="Kalan">
                <span
                  className={`font-medium tabular-nums ${order.remainingAmount > 0 ? "text-destructive-strong" : "text-success-strong"}`}
                >
                  {formatTRY(order.remainingAmount)}
                </span>
              </Row>
            )}
          </>
        )}
      </DetailPanel>
    </div>
  );
}
