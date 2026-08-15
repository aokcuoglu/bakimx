import { Suspense } from "react"
import { prisma } from "@/lib/db"
import OrderForm from "../order-form"
import { createBakimxOrder } from "../actions"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

async function getAvailableProducts() {
  return await prisma.bakimxProduct.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      sku: true,
      workshopPriceKurus: true
    },
    orderBy: { name: "asc" }
  })
}

async function getAvailableWorkshops() {
  return await prisma.workshop.findMany({
    select: {
      id: true,
      name: true
    },
    orderBy: { name: "asc" }
  })
}

export const metadata = {
  title: "Yeni Sipariş — Admin",
  description: "Yeni BakIMX siparişi oluştur"
}

function FormLoading() {
  return (
    <div className="space-y-4">
      <div className="h-10 bg-muted rounded animate-pulse" />
      <div className="h-32 bg-muted rounded animate-pulse" />
      <div className="h-10 bg-muted rounded animate-pulse" />
    </div>
  )
}

export default async function NewOrderPage() {
  const [products, workshops] = await Promise.all([
    getAvailableProducts(),
    getAvailableWorkshops()
  ])

  const handleCreateOrder = async (formData: any) => {
    "use server"
    try {
      const result = await createBakimxOrder(formData)
      if (result.success && result.order) {
        redirect(`/admin/orders/${result.order.id}`)
      }
      throw new Error(result.error || "Order creation failed")
    } catch (error) {
      if (error instanceof Error && error.message.includes("NEXT_REDIRECT")) {
        throw error
      }
      throw new Error(error instanceof Error ? error.message : "Unknown error")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Yeni Sipariş</h1>
        <p className="text-muted-foreground mt-2">
          BakIMX kataloğundan yeni bir sipariş oluşturun
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sipariş Detayları</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<FormLoading />}>
            <OrderForm
              products={products}
              workshops={workshops}
              onSubmit={handleCreateOrder}
            />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
