import { Badge } from "@/components/ui/badge"
import { getOrderStatusLabel, getPaymentStatusLabel } from "@/lib/orders/bakimx-order-utils"

interface OrderStatusBadgeProps {
  status: string
  className?: string
}

export function OrderStatusBadge({ status, className }: OrderStatusBadgeProps) {
  const { label, variant } = getOrderStatusLabel(status)
  return (
    <Badge variant={variant as any} className={className}>
      {label}
    </Badge>
  )
}

interface PaymentStatusBadgeProps {
  status: string
  className?: string
}

export function PaymentStatusBadge({ status, className }: PaymentStatusBadgeProps) {
  const label = getPaymentStatusLabel(status)
  const variant =
    status === "paid" ? "default" : status === "partial" ? "secondary" : "destructive"

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  )
}
