import { Suspense } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus } from "lucide-react"
import { getOrders, getOrderStats } from "./data"
import OrdersList from "./orders-list"

export const metadata = {
  title: "Siparişler — Admin",
  description: "BakIMX siparişlerini yönet"
}

async function OrderStats() {
  const stats = await getOrderStats()

  const statCards = [
    { label: "Toplam", value: stats.total, color: "bg-muted/50" },
    { label: "Beklemede", value: stats.pending, color: "bg-warning/10" },
    { label: "Onaylandı", value: stats.confirmed, color: "bg-muted/50" },
    { label: "Gönderilen", value: stats.shipped, color: "bg-success/10" },
    { label: "Ödenmemiş", value: stats.unpaid, color: "bg-destructive/10" },
    { label: "Kısmi Ödeme", value: stats.partialPaid, color: "bg-warning/10" }
  ]

  return (
    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
      {statCards.map((stat) => (
        <Card key={stat.label} className={stat.color}>
          <CardContent className="pt-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

async function OrdersTable() {
  const { orders } = await getOrders()
  return <OrdersList orders={orders} />
}

function LoadingTable() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Siparişler</h1>
          <p className="text-muted-foreground mt-2">BakIMX siparişlerini yönet</p>
        </div>
        <Button render={<Link href="/admin/orders/new" />} className="gap-2">
          <Plus className="h-4 w-4" />
          Yeni Sipariş
        </Button>
      </div>

      <Suspense fallback={<div className="space-y-4" />}>
        <OrderStats />
      </Suspense>

      <Suspense fallback={<LoadingTable />}>
        <OrdersTable />
      </Suspense>
    </div>
  )
}
