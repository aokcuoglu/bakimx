"use client"

import { formatDistanceToNow } from "date-fns"
import { tr } from "date-fns/locale"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface StockMovement {
  id: string
  type: string
  productId: string
  quantity: number
  reason: string
  createdAt: Date
  product?: {
    name: string
    sku: string
  }
}

interface StockMovementsListProps {
  movements: StockMovement[]
}

export function StockMovementsList({ movements }: StockMovementsListProps) {
  const getMovementTypeInfo = (type: string) => {
    const info: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      deduction: { label: "Düşüm", variant: "destructive" },
      return: { label: "İade", variant: "secondary" },
      adjustment: { label: "Ayarlama", variant: "outline" },
      initial: { label: "İlk Stok", variant: "default" }
    }
    return info[type] || { label: type, variant: "outline" }
  }

  if (movements.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Henüz stok hareketi kaydı bulunmamaktadır</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {movements.map((movement) => {
        const typeInfo = getMovementTypeInfo(movement.type)
        return (
          <Card key={movement.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">
                    {movement.product?.name || "Bilinmeyen Ürün"}
                  </h4>
                  <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {movement.product?.sku && `SKU: ${movement.product.sku}`}
                  {movement.reason && ` • ${movement.reason}`}
                </p>
              </div>
              <div className="text-right space-y-1">
                <div className={`font-medium ${
                  movement.type === "deduction" ? "text-destructive-strong" : "text-success-strong"
                }`}>
                  {movement.type === "deduction" ? "−" : "+"}{movement.quantity}
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(movement.createdAt), {
                    addSuffix: true,
                    locale: tr
                  })}
                </p>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
