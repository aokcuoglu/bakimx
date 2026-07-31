"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PaymentBadge } from "@/components/shared/status-badge"
import { TechnicianAssign, type AssignableTechnician } from "@/components/orders/technician-assign"
import { formatDate, formatDateTime } from "@/lib/utils-client"
import { formatTRY } from "@/lib/format"
import { ORDER_STATUS, arrivalReasonLabel, type OrderStatusKey } from "@/lib/constants"
import { isOrderLocked } from "@/lib/status-transitions"
import type { OrderStatus } from "@prisma/client"
import { cn } from "@/lib/utils"
import { Calendar, Receipt } from "lucide-react"
import type { OrderDetailData } from "@/components/orders/order-management-panel"

export function OrderInfoCard({
  order,
  technicians,
}: {
  order: OrderDetailData
  technicians?: AssignableTechnician[]
}) {
  const locked = isOrderLocked(order.status as OrderStatus)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Receipt className="size-4 text-muted-foreground" />
          İş Emri Bilgileri
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        <div className="grid grid-cols-1 gap-y-2.5 md:grid-cols-2 md:gap-x-8">
          {/* SOL: mevcut iş emri kimliği ve atama bilgileri */}
          <div className="space-y-2.5">
            <InfoRow label="İş No" value={order.workOrderNo} mono />
            <InfoRow label="Oluşturulma" value={formatDateTime(order.createdAt)} icon={Calendar} />
            <InfoRow
              label="Tahmini Teslim"
              value={order.estimatedDeliveryAt ? formatDateTime(order.estimatedDeliveryAt) : "—"}
              icon={Calendar}
            />
            {order.completedAt && (
              <InfoRow label="Tamamlanma" value={formatDateTime(order.completedAt)} icon={Calendar} />
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Atanan Usta</span>
              {/* Atama tek bir yerden yürür (technician-assign); burada yalnız tetikleyici durur. */}
              <TechnicianAssign
                orderId={order.id}
                assignedTechnicianId={order.assignedTechnicianId}
                assignedTechnicianName={order.assignedTechnicianName}
                technicians={technicians ?? []}
                locked={locked}
              />
            </div>
            {order.technicianName && order.technicianName !== order.assignedTechnicianName && (
              <InfoRow label="Teknisyen (eski)" value={order.technicianName} />
            )}
            {order.notes && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">Notlar</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{order.notes}</p>
              </div>
            )}
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1.5">Ödeme</p>
              <PaymentBadge status={order.paymentStatus} size="md" />
            </div>
          </div>

          {/* SAĞ: fatura, tutar, durum, geliş nedeni.
              Mobilde dikey çizgi yerine üst kenarlık — kolonlar alt alta düşüyor. */}
          <div className="space-y-2.5 border-t pt-3 md:border-t-0 md:border-l md:pt-0 md:pl-6">
            <InfoRow label="Fatura Numarası" value={order.invoiceNo || "—"} mono />
            <InfoRow
              label="Fatura Tarihi"
              value={order.invoiceDate ? formatDate(order.invoiceDate) : "—"}
              icon={Calendar}
            />
            <InfoRow
              label="Toplam Tutar"
              value={order.totals.hasAnyPrice ? formatTRY(order.totals.grandTotal) : "—"}
            />
            <InfoRow label="Durum" value={ORDER_STATUS[order.status as OrderStatusKey]?.label ?? order.status} />
            <InfoRow label="Servise Geliş Nedeni" value={arrivalReasonLabel(order.arrivalReason)} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function InfoRow({
  label,
  value,
  mono,
  icon: Icon,
}: {
  label: string
  value: string
  mono?: boolean
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm text-foreground flex items-center gap-1.5", mono && "font-mono text-xs")}>
        {Icon && <Icon className="size-3.5 text-muted-foreground/70" />}
        {value}
      </span>
    </div>
  )
}
