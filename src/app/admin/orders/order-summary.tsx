"use client"

import { Card, CardContent } from "@/components/ui/card"
import { formatKurus } from "@/lib/currency"
import { calculateOrderTotalWithTax } from "@/lib/orders/bakimx-order-utils"

interface OrderItem {
  quantity: number
  unitPriceKurus: number
  totalPriceKurus: number
}

interface OrderSummaryProps {
  items: OrderItem[]
  totalPriceKurus: number
  showTax?: boolean
  taxRateBps?: number
}

export function OrderSummary({
  items,
  totalPriceKurus,
  showTax = true,
  taxRateBps = 2000
}: OrderSummaryProps) {
  const itemCount = items.length
  const itemsTotal = items.reduce((sum, item) => sum + item.totalPriceKurus, 0)

  const { tax, total } = showTax
    ? calculateOrderTotalWithTax(itemsTotal, taxRateBps)
    : { tax: 0, total: itemsTotal }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Kalem Sayısı</span>
            <span className="font-medium">{itemCount}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Ara Toplam</span>
            <span className="font-medium">{formatKurus(itemsTotal)}</span>
          </div>
          {showTax && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">KDV ({(taxRateBps / 100).toFixed(0)}%)</span>
              <span className="font-medium">{formatKurus(tax)}</span>
            </div>
          )}
          <div className="pt-2 border-t border-muted">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Toplam</span>
              <span className="text-lg font-bold">{formatKurus(total)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
