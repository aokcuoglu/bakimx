"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OrderItemsTable } from "../order-items-table"
import { StockMovementsList } from "../stock-movements-list"
import { OrderNotes } from "../order-notes"
import { AddNoteDialog } from "../add-note-dialog"
import { OrderStatusBadge, PaymentStatusBadge } from "../order-status-badge"
import OrderStatusActions from "./order-actions"
import { formatKurus } from "@/lib/currency"
import { Building2, CreditCard, Package } from "lucide-react"

interface OrderDetailViewProps {
  order: any
}

export default function OrderDetailView({ order }: OrderDetailViewProps) {
  const totalKurus = order.totalPriceKurus || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sipariş Detayı</h1>
        <p className="text-muted-foreground mt-2">BX-{order.id.slice(0, 8).toUpperCase()}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span className="text-sm">Atölye</span>
            </div>
            <p className="text-lg font-semibold">{order.workshop?.name || "—"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CreditCard className="h-4 w-4" />
              <span className="text-sm">Toplam</span>
            </div>
            <p className="text-lg font-semibold">{formatKurus(totalKurus)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span className="text-sm">Ürünler</span>
            </div>
            <p className="text-lg font-semibold">{order.items.length} kalem</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Durum & Ödeme</CardTitle>
            <div className="flex gap-2">
              <OrderStatusBadge status={order.status} />
              <PaymentStatusBadge status={order.paymentStatus} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <OrderStatusActions orderId={order.id} />
        </CardContent>
      </Card>

      <Tabs defaultValue="items" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="items">Ürünler</TabsTrigger>
          <TabsTrigger value="stock">Stok Hareketleri</TabsTrigger>
          <TabsTrigger value="notes">Notlar</TabsTrigger>
        </TabsList>

        <TabsContent value="items">
          <Card>
            <CardContent className="pt-6">
              <OrderItemsTable items={order.items} showStatus={false} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stock">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Stok Hareketleri</CardTitle>
            </CardHeader>
            <CardContent>
              <StockMovementsList movements={order.stock_movements} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>İç Notlar</CardTitle>
              <AddNoteDialog orderId={order.id} />
            </CardHeader>
            <CardContent>
              {order.notes ? (
                <div className="whitespace-pre-wrap break-words text-sm text-foreground">
                  {order.notes}
                </div>
              ) : (
                <p className="text-muted-foreground">Henüz not bulunmamaktadır</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
