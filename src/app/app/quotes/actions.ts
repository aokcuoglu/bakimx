"use server"

import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { quoteCreateSchema, quoteStatusUpdateSchema, quoteItemSchema } from "@/lib/validation"
import { getValidationError } from "@/lib/validation"
import { generateQuoteNo, formatQuoteNo } from "@/lib/work-order-number"
import { generateUniqueWorkOrderNo } from "@/lib/work-order-number"
import { AuditLogAction } from "@/lib/audit"
import { notifyQuoteReady } from "@/lib/communications/triggers"

export async function createQuoteAction(formData: FormData) {
  const user = await requireAuth()
  const workshopId = user.workshopId

  const raw: Record<string, unknown> = {}
  const fields = ["customerId", "vehicleId", "title", "customerRequest", "internalNote", "validUntil", "status", "discountAmount", "taxRate", "estimatedLaborTotal", "estimatedPartsTotal", "grandTotal"]
  for (const f of fields) {
    const v = formData.get(f)
    if (v && typeof v === "string" && v.trim()) raw[f] = v
  }

  const parsed = quoteCreateSchema.safeParse(raw)
  if (!parsed.success) return { error: getValidationError(parsed) }

  const { customerId, validUntil, ...data } = parsed.data

  const customer = await prisma.customer.findFirst({ where: { id: customerId, workshopId } })
  if (!customer) return { error: "Müşteri bulunamadı" }

  if (data.vehicleId) {
    const vehicle = await prisma.vehicle.findFirst({ where: { id: data.vehicleId, workshopId, customerId } })
    if (!vehicle) return { error: "Araç bulunamadı veya müşteriyle eşleşmiyor" }
  }

  const quote = await prisma.quote.create({
    data: {
      workshopId,
      customerId,
      vehicleId: data.vehicleId || null,
      quoteNo: generateQuoteNo(),
      title: data.title || null,
      customerRequest: data.customerRequest || null,
      internalNote: data.internalNote || null,
      validUntil: validUntil ? new Date(validUntil) : null,
      status: data.status || "draft",
      discountAmount: data.discountAmount ? Number(data.discountAmount) : null,
      taxRate: data.taxRate ? Number(data.taxRate) : null,
      estimatedLaborTotal: data.estimatedLaborTotal ? Number(data.estimatedLaborTotal) : null,
      estimatedPartsTotal: data.estimatedPartsTotal ? Number(data.estimatedPartsTotal) : null,
      grandTotal: data.grandTotal ? Number(data.grandTotal) : null,
    },
  })

  const itemsJson = formData.get("items")
  if (itemsJson && typeof itemsJson === "string") {
    const items = JSON.parse(itemsJson) as Array<Record<string, unknown>>
    for (const item of items) {
      const parsedItem = quoteItemSchema.safeParse(item)
      if (parsedItem.success) {
        await prisma.quoteItem.create({
          data: {
            workshopId,
            quoteId: quote.id,
            type: parsedItem.data.type,
            name: parsedItem.data.name,
            quantity: parsedItem.data.quantity,
            unitPrice: parsedItem.data.unitPrice ? Number(parsedItem.data.unitPrice) : null,
            totalPrice: parsedItem.data.totalPrice ? Number(parsedItem.data.totalPrice) : null,
            note: parsedItem.data.note || null,
          },
        })
      }
    }
  }

  await AuditLogAction(workshopId, user.id, "Quote", quote.id, "quote_created")
  revalidatePath("/app/quotes")
  return { success: true, id: quote.id, quoteNo: quote.quoteNo || formatQuoteNo(quote) }
}

export async function updateQuoteStatusAction(formData: FormData) {
  const user = await requireAuth()
  const workshopId = user.workshopId
  const quoteId = formData.get("quoteId") as string
  const newStatus = formData.get("status") as string

  if (!quoteId || !newStatus) return { error: "Eksik parametre" }

  const parsed = quoteStatusUpdateSchema.safeParse({ status: newStatus })
  if (!parsed.success) return { error: getValidationError(parsed) }

  const quote = await prisma.quote.findFirst({ where: { id: quoteId, workshopId } })
  if (!quote) return { error: "Teklif bulunamadı" }

  if (quote.status === "converted") return { error: "İş emrine çevrilmiş teklifin durumu değiştirilemez" }
  if (quote.status === "cancelled") return { error: "İptal edilmiş teklifin durumu değiştirilemez" }

  await prisma.quote.update({
    where: { id: quoteId },
    data: { status: parsed.data.status },
  })

  await AuditLogAction(workshopId, user.id, "Quote", quoteId, `quote_status_${parsed.data.status}`)

  if (parsed.data.status === "sent") {
    const quoteWithDetails = await prisma.quote.findFirst({
      where: { id: quoteId, workshopId },
      include: { customer: true, vehicle: true },
    })
    if (quoteWithDetails) {
      const { formatTRY } = await import("@/lib/format")
      try {
        await notifyQuoteReady(
          workshopId,
          quote.customerId,
          quoteWithDetails.vehicle?.plate || null,
          quote.quoteNo || formatQuoteNo(quote),
          quote.grandTotal != null ? formatTRY(quote.grandTotal) : null,
          undefined,
          quoteId,
        )
      } catch (e) {
        console.error("[notifyQuoteReady] Teklif bildirimi gönderilemedi:", e)
      }
    }
  }

  revalidatePath(`/app/quotes/${quoteId}`)
  revalidatePath("/app/quotes")
  return { success: true }
}

export async function convertQuoteToWorkOrderAction(formData: FormData) {
  const user = await requireAuth()
  const workshopId = user.workshopId
  const quoteId = formData.get("quoteId") as string
  if (!quoteId) return { error: "Teklif ID gerekli" }

  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, workshopId },
    include: { items: true },
  })
  if (!quote) return { error: "Teklif bulunamadı" }
  if (quote.status === "converted") return { error: "Bu teklif zaten iş emrine çevrilmiş" }
  if (quote.status === "cancelled") return { error: "İptal edilmiş teklif iş emrine çevrilemez" }

  const customer = await prisma.customer.findFirst({ where: { id: quote.customerId, workshopId } })
  if (!customer) return { error: "Müşteri bulunamadı" }

  const resolvedVehicleId = quote.vehicleId
    ? (await prisma.vehicle.findFirst({ where: { id: quote.vehicleId, workshopId } }))?.id ?? null
    : await getFirstVehicle(workshopId, quote.customerId)

  if (!resolvedVehicleId) {
    return { error: "Dönüştürme için müşteriye ait bir araç bulunamadı" }
  }

  const intake = await prisma.vehicleIntakeForm.create({
    data: {
      workshopId,
      customerId: quote.customerId,
      vehicleId: resolvedVehicleId,
      customerComplaint: quote.customerRequest || "Tekliften dönüştürüldü",
      internalNote: quote.internalNote || undefined,
      status: "draft",
    },
  })

  const workOrderNo = await generateUniqueWorkOrderNo((candidate) =>
    prisma.serviceOrder
      .findFirst({ where: { workshopId, workOrderNo: candidate }, select: { id: true } })
      .then((clash) => clash !== null)
  )

  const order = await prisma.serviceOrder.create({
    data: {
      workshopId,
      intakeFormId: intake.id,
      workOrderNo,
      status: "draft",
      discountAmount: quote.discountAmount,
      taxRate: quote.taxRate,
      notes: `${quote.customerRequest || ""}\n\nTeklif No: ${formatQuoteNo(quote)}`.trim(),
    },
  })

  for (const item of quote.items) {
    await prisma.serviceOrderItem.create({
      data: {
        workshopId,
        serviceOrderId: order.id,
        type: item.type === "part" ? "part" : "labor",
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        note: item.note,
      },
    })
  }

  await prisma.quote.update({
    where: { id: quoteId },
    data: { status: "converted", convertedServiceOrderId: order.id },
  })

  await AuditLogAction(workshopId, user.id, "Quote", quoteId, "quote_converted_to_work_order")
  await AuditLogAction(workshopId, user.id, "ServiceOrder", order.id, "service_order_created_from_quote")
  revalidatePath(`/app/quotes/${quoteId}`)
  revalidatePath("/app/quotes")
  revalidatePath("/app/orders")
  return { success: true, orderId: order.id }
}

export async function getQuotesAction(search?: string, status?: string) {
  const user = await requireAuth()
  const workshopId = user.workshopId

  const where: Record<string, unknown> = { workshopId }

  if (status && status !== "all") where.status = status

  if (search) {
    where.OR = [
      { quoteNo: { contains: search, mode: "insensitive" } },
      { customer: { phone: { contains: search } } },
      { customer: { firstName: { contains: search, mode: "insensitive" } } },
      { customer: { lastName: { contains: search, mode: "insensitive" } } },
      { customer: { fullName: { contains: search, mode: "insensitive" } } },
      { customer: { companyName: { contains: search, mode: "insensitive" } } },
      { vehicle: { plate: { contains: search, mode: "insensitive" } } },
    ]
  }

  const quotes = await prisma.quote.findMany({
    where: where as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    include: {
      customer: { select: { id: true, firstName: true, lastName: true, fullName: true, companyName: true, type: true, phone: true } },
      vehicle: { select: { id: true, plate: true, brand: true, model: true } },
      items: { select: { id: true, type: true, quantity: true, unitPrice: true, totalPrice: true } },
      convertedServiceOrder: { select: { id: true, workOrderNo: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return quotes.map((q) => ({
    id: q.id,
    workshopId: q.workshopId,
    customerId: q.customerId,
    vehicleId: q.vehicleId,
    quoteNo: q.quoteNo || formatQuoteNo(q),
    status: q.status,
    title: q.title,
    customerRequest: q.customerRequest,
    internalNote: q.internalNote,
    validUntil: q.validUntil?.toISOString() ?? null,
    estimatedLaborTotal: q.estimatedLaborTotal,
    estimatedPartsTotal: q.estimatedPartsTotal,
    discountAmount: q.discountAmount,
    taxRate: q.taxRate,
    grandTotal: q.grandTotal,
    convertedServiceOrderId: q.convertedServiceOrderId,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
    customer: q.customer,
    vehicle: q.vehicle,
    items: q.items,
    convertedServiceOrder: q.convertedServiceOrder,
  }))
}

export async function getQuoteCountsByStatus() {
  const user = await requireAuth()
  const workshopId = user.workshopId

  const statuses = ["draft", "sent", "accepted", "rejected", "expired", "converted", "cancelled"] as const
  const counts: Record<string, number> = {}

  for (const s of statuses) {
    counts[s] = await prisma.quote.count({ where: { workshopId, status: s } })
  }

  return counts
}

async function getFirstVehicle(workshopId: string, customerId: string): Promise<string | null> {
  const vehicle = await prisma.vehicle.findFirst({
    where: { workshopId, customerId },
    select: { id: true },
  })
  return vehicle?.id || null
}
