"use server"

import { prisma } from "@/lib/db"
import { AuditLogAction } from "@/lib/audit"
import { revalidatePath } from "next/cache"
import { z } from "zod/v4"
import { computePaymentStatus, computeRemainingAmount } from "@/lib/cashbox/status"
import { calculateOrderTotalsFromMinimal } from "@/lib/totals"

const collectionCreateSchema = z.object({
  customerId: z.string().min(1, "Müşteri seçimi zorunludur"),
  serviceOrderId: z.string().optional().or(z.literal("")),
  quoteId: z.string().optional().or(z.literal("")),
  amount: z.coerce.number().min(0.01, "Tutar sıfırdan büyük olmalıdır"),
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
  }

  const paymentDate = new Date(data.paymentDate)
  if (isNaN(paymentDate.getTime())) return { error: "Geçersiz tahsilat tarihi" }

  const collection = await prisma.collectionPayment.create({
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

  if (data.serviceOrderId) {
    await updateOrderPaymentStatus(data.serviceOrderId, user.workshopId)
  }

  await AuditLogAction(user.workshopId, user.id, "CollectionPayment", collection.id, "collection_created")

  revalidatePath("/app/cashbox")
  revalidatePath("/app/cashbox/payments")
  if (data.serviceOrderId) {
    revalidatePath(`/app/orders/${data.serviceOrderId}`)
    revalidatePath("/app/orders")
  }
  revalidatePath(`/app/customers/${data.customerId}`)
  revalidatePath("/app/customers/balances")
  revalidatePath("/app")

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

  await prisma.collectionPayment.updateMany({
    where: { id: collectionId, workshopId: user.workshopId },
    data: {
      status: "cancelled",
      cancellationReason,
    },
  })

  if (collection.serviceOrderId) {
    await updateOrderPaymentStatus(collection.serviceOrderId, user.workshopId)
  }

  await AuditLogAction(
    user.workshopId,
    user.id,
    "CollectionPayment",
    collectionId,
    "collection_cancelled",
    JSON.stringify({ reason: cancellationReason, amount: collection.amount, method: collection.method })
  )

  revalidatePath("/app/cashbox")
  revalidatePath("/app/cashbox/payments")
  revalidatePath(`/app/cashbox/payments/${collectionId}`)
  if (collection.serviceOrderId) {
    revalidatePath(`/app/orders/${collection.serviceOrderId}`)
    revalidatePath("/app/orders")
  }
  revalidatePath(`/app/customers/${collection.customerId}`)
  revalidatePath("/app/customers/balances")
  revalidatePath("/app")

  return { success: true }
}

async function updateOrderPaymentStatus(serviceOrderId: string, workshopId: string) {
  const order = await prisma.serviceOrder.findFirst({
    where: { id: serviceOrderId, workshopId },
    include: { items: { select: { totalPrice: true, unitPrice: true, quantity: true, type: true } } },
  })
  if (!order) return

  const totals = calculateOrderTotalsFromMinimal(order.items, {
    discountAmount: order.discountAmount,
    taxRate: order.taxRate,
  })

  const collections = await prisma.collectionPayment.findMany({
    where: { serviceOrderId, workshopId, status: "completed" },
  })

  const paidAmount = collections.reduce((sum, c) => sum + c.amount, 0)
  const newPaymentStatus = computePaymentStatus(totals.grandTotal, paidAmount)
  const remainingAmount = computeRemainingAmount(totals.grandTotal, paidAmount)
  const lastPaymentAt = collections.length > 0
    ? collections.sort((a, b) => b.paymentDate.getTime() - a.paymentDate.getTime())[0].paymentDate
    : null

  await prisma.serviceOrder.updateMany({
    where: { id: serviceOrderId, workshopId },
    data: {
      paymentStatus: newPaymentStatus as import("@prisma/client").PaymentStatus,
      paidAmount,
      remainingAmount,
      lastPaymentAt,
    },
  })

  if (order.paymentStatus !== newPaymentStatus) {
    await AuditLogAction(workshopId, undefined, "ServiceOrder", serviceOrderId, `payment_status_changed_to_${newPaymentStatus}`)
  }
}

export async function getCustomerOrdersForPayment(workshopId: string, customerId: string) {
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
      const paid = paidByOrder.get(order.id) || order.paidAmount || 0
      const remaining = Math.max(0, totals.grandTotal - paid)
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