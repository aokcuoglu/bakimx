"use server"

import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import { recalcOrderPayment } from "@/lib/cashbox/recalc"
import { calculateOrderTotalsFromMinimal } from "@/lib/totals"
import { subKurus, sumKurus } from "@/lib/money"

const collectionCreateSchema = z.object({
  customerId: z.string().min(1, "Müşteri seçimi zorunludur"),
  serviceOrderId: z.string().optional().or(z.literal("")),
  quoteId: z.string().optional().or(z.literal("")),
  amount: z.coerce.number().int("Tutar kuruş (tam sayı) olmalıdır").min(1, "Tutar sıfırdan büyük olmalıdır"), // kuruş
  method: z.enum(["cash", "credit_card", "bank_transfer", "other"], {
    error: "Geçerli bir ödeme yöntemi seçiniz",
  }),
  paymentDate: z.string().min(1, "Tahsilat tarihi zorunludur"),
  referenceNo: z.string().optional().or(z.literal("")),
  note: z.string().optional().or(z.literal("")),
})

export async function createCollectionAction(formData: FormData) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()

  const raw = {
    customerId: formData.get("customerId") as string,
    serviceOrderId: formData.get("serviceOrderId") as string,
    quoteId: formData.get("quoteId") as string,
    amount: formData.get("amount") as string,
    method: formData.get("method") as string,
    paymentDate: formData.get("paymentDate") as string,
    referenceNo: formData.get("referenceNo") as string,
    note: formData.get("note") as string,
  }

  const parsed = collectionCreateSchema.safeParse({
    ...raw,
    serviceOrderId: raw.serviceOrderId || "",
    quoteId: raw.quoteId || "",
    referenceNo: raw.referenceNo || "",
    note: raw.note || "",
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  const data = parsed.data

  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, workshopId: user.workshopId },
  })
  if (!customer) return { error: "Müşteri bulunamadı" }

  if (data.serviceOrderId) {
    const order = await prisma.serviceOrder.findFirst({
      where: { id: data.serviceOrderId, workshopId: user.workshopId },
    })
    if (!order) return { error: "İş emri bulunamadı" }
    if (order.status === "cancelled") return { error: "İptal edilmiş iş emrine tahsilat eklenemez" }
  }

  const paymentDate = new Date(data.paymentDate)
  if (isNaN(paymentDate.getTime())) return { error: "Geçersiz tahsilat tarihi" }

  const { collection, recalc } = await prisma.$transaction(async (tx) => {
    const created = await tx.collectionPayment.create({
      data: {
        workshopId: user.workshopId,
        customerId: data.customerId,
        serviceOrderId: data.serviceOrderId || null,
        quoteId: data.quoteId || null,
        amount: data.amount,
        method: data.method as import("@prisma/client").PaymentMethod,
        status: "completed",
        paymentDate,
        referenceNo: data.referenceNo || null,
        note: data.note || null,
        createdByUserId: user.id,
      },
    })

    const recalcResult = data.serviceOrderId
      ? await recalcOrderPayment(tx, data.serviceOrderId, user.workshopId)
      : null

    return { collection: created, recalc: recalcResult }
  })

  if (recalc?.statusChanged && data.serviceOrderId) {
    await AuditLogAction(
      user.workshopId,
      undefined,
      "ServiceOrder",
      data.serviceOrderId,
      `payment_status_changed_to_${recalc.newStatus}`
    )
  }

  await AuditLogAction(user.workshopId, user.id, "CollectionPayment", collection.id, "collection_created")

  revalidatePath("/cashbox")
  revalidatePath("/cashbox/payments")
  if (data.serviceOrderId) {
    revalidatePath(`/orders/${data.serviceOrderId}`)
    revalidatePath("/orders")
  }
  revalidatePath(`/customers/${data.customerId}`)
  revalidatePath("/customers/balances")
  revalidatePath("/dashboard")

  return { success: true, id: collection.id }
}

export async function cancelCollectionAction(collectionId: string, reason?: string) {
  const { requireAuth } = await import("@/lib/auth")
  const user = await requireAuth()

  const collection = await prisma.collectionPayment.findFirst({
    where: { id: collectionId, workshopId: user.workshopId },
  })
  if (!collection) return { error: "Tahsilat kaydı bulunamadı" }
  if (collection.status !== "completed") return { error: "Sadece tamamlanmış tahsilatlar iptal edilebilir" }

  const trimmedReason = (reason || "").trim()
  if (!trimmedReason) return { error: "İptal nedeni zorunludur" }
  const cancellationReason = trimmedReason

  const recalc = await prisma.$transaction(async (tx) => {
    await tx.collectionPayment.updateMany({
      where: { id: collectionId, workshopId: user.workshopId },
      data: {
        status: "cancelled",
        cancellationReason,
      },
    })

    return collection.serviceOrderId
      ? await recalcOrderPayment(tx, collection.serviceOrderId, user.workshopId)
      : null
  })

  if (recalc?.statusChanged && collection.serviceOrderId) {
    await AuditLogAction(
      user.workshopId,
      undefined,
      "ServiceOrder",
      collection.serviceOrderId,
      `payment_status_changed_to_${recalc.newStatus}`
    )
  }

  await AuditLogAction(
    user.workshopId,
    user.id,
    "CollectionPayment",
    collectionId,
    "collection_cancelled",
    JSON.stringify({ reason: cancellationReason, amount: collection.amount, method: collection.method })
  )

  revalidatePath("/cashbox")
  revalidatePath("/cashbox/payments")
  revalidatePath(`/cashbox/payments/${collectionId}`)
  if (collection.serviceOrderId) {
    revalidatePath(`/orders/${collection.serviceOrderId}`)
    revalidatePath("/orders")
  }
  revalidatePath(`/customers/${collection.customerId}`)
  revalidatePath("/customers/balances")
  revalidatePath("/dashboard")

  return { success: true }
}

export async function getCustomerOrdersForPayment(customerId: string) {
  const { requireAuth } = await import("@/lib/auth")
  const { workshopId } = await requireAuth()
  const intakes = await prisma.vehicleIntakeForm.findMany({
    where: { customerId, workshopId },
    include: {
      order: {
        include: {
          items: { select: { totalPrice: true, unitPrice: true, quantity: true, type: true } },
        },
      },
      vehicle: { select: { plate: true, brand: true, model: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const orderIds = intakes.map((i) => i.order?.id).filter(Boolean) as string[]

  const collections = orderIds.length > 0
    ? await prisma.collectionPayment.findMany({
        where: { serviceOrderId: { in: orderIds }, workshopId, status: "completed" },
      })
    : []

  const paidByOrder = new Map<string, number>()
  for (const c of collections) {
    if (c.serviceOrderId) {
      paidByOrder.set(c.serviceOrderId, (paidByOrder.get(c.serviceOrderId) || 0) + c.amount)
    }
  }

  return intakes
    .filter((i) => i.order && i.order.status !== "cancelled")
    .map((i) => {
      const order = i.order!
      const totals = calculateOrderTotalsFromMinimal(order.items, {
        discountAmount: order.discountAmount,
        taxRate: order.taxRate,
      })
      const paid = sumKurus([paidByOrder.get(order.id) ?? order.paidAmount ?? 0])
      const remaining = Math.max(0, subKurus(totals.grandTotal, paid))
      return {
        id: order.id,
        workOrderNo: order.workOrderNo,
        status: order.status,
        paymentStatus: order.paymentStatus,
        grandTotal: totals.grandTotal,
        paidAmount: paid,
        remainingAmount: remaining,
        vehicle: {
          plate: i.vehicle.plate,
          brand: i.vehicle.brand,
          model: i.vehicle.model,
        },
      }
    })
}