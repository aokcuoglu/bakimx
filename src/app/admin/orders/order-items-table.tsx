"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { formatKurus } from "@/lib/currency"

interface OrderItem {
  id: string
  productId: string
  product?: {
    name: string
    sku: string
  }
  quantity: number
  unitPriceKurus: number
  totalPriceKurus: number
  status?: string
}

interface OrderItemsTableProps {
  items: OrderItem[]
  showStatus?: boolean
}

export function OrderItemsTable({ items, showStatus = false }: OrderItemsTableProps) {
  const getItemStatusBadge = (status?: string) => {
    if (!status) return null

    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      pending: "outline",
      confirmed: "secondary",
      shipped: "default",
      delivered: "default",
      cancelled: "destructive"
    }

    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ürün</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead className="text-right">Miktar</TableHead>
            <TableHead className="text-right">Birim Fiyat</TableHead>
            <TableHead className="text-right">Toplam</TableHead>
            {showStatus && <TableHead>Durum</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showStatus ? 6 : 5} className="text-center text-muted-foreground py-8">
                Ürün bulunmamaktadır
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  {item.product?.name || "Bilinmeyen Ürün"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {item.product?.sku || "—"}
                </TableCell>
                <TableCell className="text-right">{item.quantity}</TableCell>
                <TableCell className="text-right">{formatKurus(item.unitPriceKurus)}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatKurus(item.totalPriceKurus)}
                </TableCell>
                {showStatus && (
                  <TableCell>{getItemStatusBadge(item.status)}</TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
