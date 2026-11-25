import { ORDER_TOTALS_ITEM_SELECT } from "@/lib/totals"
import { NextResponse } from "next/server"
import { getCurrentUserWithWorkshop } from "@/lib/auth"
import { assertWritableOr403 } from "@/lib/plan-guard"
import { prisma } from "@/lib/db"
import { notifyCollectionReminder } from "@/lib/communications/triggers"
import type { SendableChannel } from "@/lib/communications/types"
import { featureLockedMessage, hasWorkshopFeature } from "@/lib/plan"

export async function POST(request: Request) {
  try {
    const { user, workshop } = await getCurrentUserWithWorkshop()
    const locked = assertWritableOr403(workshop)
    if (locked) return locked
    if (!hasWorkshopFeature(workshop, "cashbox")) {
      return NextResponse.json(
        { error: featureLockedMessage("cashbox"), code: "feature_locked" },
        { status: 403 },
      )
    }
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
          items: { select: ORDER_TOTALS_ITEM_SELECT },
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

    // WhatsApp Business API gönderimi kaldırıldı (#746): eski istemciden gelen
    // "whatsapp" sessizce elenir, gönderilebilir kanallar SMS ve e-postadır.
    const sendChannels = (channels || ["sms"]).filter(
      (c): c is SendableChannel => c === "sms" || c === "email"
    )

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
