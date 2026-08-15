"use client"

import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { tr } from "date-fns/locale"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronRight } from "lucide-react"
import { formatKurus } from "@/lib/currency"
import { OrderStatusBadge, PaymentStatusBadge } from "./order-status-badge"

interface Order {
  id: string
  workshopId: string
  status: string
  paymentStatus: string
  totalPriceKurus: number
  createdAt: Date
  workshop?: { name: string }
  items: Array<{ id: string }>
}

interface OrdersListProps {
  orders: Order[]
}

export default function OrdersList({ orders }: OrdersListProps) {
  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 text-muted-foreground">
            <p>Henüz sipariş bulunmamaktadır</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sipariş</TableHead>
            <TableHead>Atölye</TableHead>
            <TableHead className="text-right">Kalem</TableHead>
            <TableHead className="text-right">Toplam</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead>Ödeme</TableHead>
            <TableHead className="text-right">Tarih</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-mono text-sm">
                BX-{order.id.slice(0, 8).toUpperCase()}
              </TableCell>
              <TableCell>{order.workshop?.name || "—"}</TableCell>
              <TableCell className="text-right">{order.items.length}</TableCell>
              <TableCell className="text-right font-medium">
                {formatKurus(order.totalPriceKurus)}
              </TableCell>
              <TableCell>
                <OrderStatusBadge status={order.status} />
              </TableCell>
              <TableCell>
                <PaymentStatusBadge status={order.paymentStatus} />
              </TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(order.createdAt), {
                  addSuffix: true,
                  locale: tr
                })}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  render={<Link href={`/admin/orders/${order.id}`} />}
                  className="gap-1"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
