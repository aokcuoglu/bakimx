import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { notifyCollectionReminder } from "@/lib/communications/triggers"

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json()
    const { customerId, serviceOrderId, channels } = body as {
      customerId?: string
      serviceOrderId?: string
      channels?: string[]
    }

    if (!customerId) {
      return NextResponse.json({ error: "Müşteri ID zorunludur" }, { status: 400 })
    }

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, workshopId: user.workshopId },
    })
    if (!customer) {
      return NextResponse.json({ error: "Müşteri bulunamadı" }, { status: 404 })
    }

    let vehiclePlate: string | null = null
    let totalAmount: string | null = null

    if (serviceOrderId) {
      const order = await prisma.serviceOrder.findFirst({
        where: { id: serviceOrderId, workshopId: user.workshopId },
        include: {
          items: { select: { totalPrice: true, unitPrice: true, quantity: true, type: true } },
          intakeForm: { select: { vehicle: { select: { plate: true } } } },
        },
      })
      if (order) {
        const totals = await import("@/lib/totals").then((m) =>
          m.calculateOrderTotalsFromMinimal(order.items, {
            discountAmount: order.discountAmount,
            taxRate: order.taxRate,
          })
        )
        vehiclePlate = order.intakeForm.vehicle.plate
        if (totals.hasAnyPrice) {
          const { formatTRY } = await import("@/lib/format")
          totalAmount = formatTRY(totals.grandTotal)
        }
      }
    }

    const sendChannels = (channels || ["sms", "whatsapp"]).filter(
      (c): c is "sms" | "whatsapp" | "email" => ["sms", "whatsapp", "email"].includes(c)
    ) as Array<"sms" | "whatsapp" | "email">

    const result = await notifyCollectionReminder(
      user.workshopId,
      customerId,
      vehiclePlate,
      totalAmount || "0",
      undefined,
      serviceOrderId,
      sendChannels,
    )

    await prisma.auditLog.create({
      data: {
        workshopId: user.workshopId,
        actorUserId: user.id,
        entityType: "CollectionReminder",
        entityId: serviceOrderId || customerId,
        action: "collection_reminder_sent",
        metadataJson: JSON.stringify({ customerId, serviceOrderId, channels: sendChannels }),
      },
    })

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error("Collection reminder error:", error)
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}