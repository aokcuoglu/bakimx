import { notFound } from "next/navigation"
import { prisma } from "@/lib/db"
import { VISIBLE_PHOTO } from "@/lib/intake/photo-visibility"
import OrderDetailView from "./order-detail"

export const metadata = {
  title: "Sipariş Detayı — Admin",
  description: "BakIMX sipariş detaylarını görüntüle"
}

interface OrderDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params

  const order = await prisma.bakimxOrder.findUnique({
    where: { id },
    include: {
      workshop: true,
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true } }
        }
      },
      stock_movements: {
        include: {
          product: { select: { name: true, sku: true } }
        },
        orderBy: { createdAt: "desc" }
      },
      photos: {
        where: VISIBLE_PHOTO
      },
      sync_logs: {
        orderBy: { createdAt: "desc" }
      }
    }
  })

  if (!order) {
    notFound()
  }

  return <OrderDetailView order={order} />
}
