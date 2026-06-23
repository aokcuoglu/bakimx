"use server"

import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { customerCreateSchema } from "@/lib/validation"
import { revalidatePath } from "next/cache"
import { AuditLogAction } from "@/lib/audit"
import { normalizePhone } from "@/lib/format"
import type { CustomerTag, CustomerType, CustomerPriceGroup, CustomerSource, Prisma } from "@prisma/client"

function parseKvkkDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function buildCustomerName(data: {
  type: CustomerType
  firstName?: string | null
  lastName?: string | null
  fullName?: string | null
  companyName?: string | null
}) {
  if (data.type === "corporate") return (data.companyName || "").trim()
  const full = (data.fullName || "").trim()
  if (full) return full
  const first = (data.firstName || "").trim()
  const last = (data.lastName || "").trim()
  return [first, last].filter(Boolean).join(" ")
}

export async function createCustomerAction(formData: FormData) {
  const user = await requireAuth()

  const type = (formData.get("type") as string) || "individual"
  const raw = {
    type,
    firstName: (formData.get("firstName") as string || "").trim(),
    lastName: (formData.get("lastName") as string || "").trim(),
    fullName: (formData.get("fullName") as string || "").trim(),
    companyName: (formData.get("companyName") as string || "").trim(),
    contactName: (formData.get("contactName") as string || "").trim(),
    phone: normalizePhone(formData.get("phone") as string || ""),
    phone2: normalizePhone(formData.get("phone2") as string || ""),
    email: (formData.get("email") as string || "").trim(),
    city: (formData.get("city") as string || "").trim(),
    district: (formData.get("district") as string || "").trim(),
    address: (formData.get("address") as string || "").trim(),
    identityNumber: (formData.get("identityNumber") as string || "").trim(),
    taxNumber: (formData.get("taxNumber") as string || "").trim(),
    taxOffice: (formData.get("taxOffice") as string || "").trim(),
    notes: (formData.get("notes") as string || "").trim(),
    tag: ((formData.get("tag") as string) || "standard") as CustomerTag,
    source: ((formData.get("source") as string) || "") as CustomerSource | "",
    priceGroup: ((formData.get("priceGroup") as string) || "standard") as CustomerPriceGroup,
    discountRate: (formData.get("discountRate") as string) || "0",
    riskNote: (formData.get("riskNote") as string || "").trim(),
    whatsappConsent: formData.get("whatsappConsent") === "on" || formData.get("whatsappConsent") === "true",
    smsConsent: formData.get("smsConsent") === "on" || formData.get("smsConsent") === "true",
    emailConsent: formData.get("emailConsent") === "on" || formData.get("emailConsent") === "true",
    kvkkApprovedAt: (formData.get("kvkkApprovedAt") as string) || "",
  }

  const parsed = customerCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  const data = parsed.data
  const customerType: CustomerType = data.type === "corporate" ? "corporate" : "individual"
  const firstName = customerType === "individual" ? (data.firstName || data.fullName || "").trim() || null : (data.contactName || "").trim() || null
  const lastName = customerType === "individual" ? (data.lastName || "").trim() || null : null
  const fullName = buildCustomerName({
    type: customerType,
    firstName: data.firstName,
    lastName: data.lastName,
    fullName: data.fullName,
    companyName: data.companyName,
  })
  const companyName = customerType === "corporate" ? (data.companyName || "").trim() || null : null

  const customer = await prisma.customer.create({
    data: {
      workshopId: user.workshopId,
      type: customerType,
      firstName,
      lastName,
      fullName: fullName || null,
      companyName,
      contactName: customerType === "corporate" ? (data.contactName || "").trim() || null : null,
      phone: data.phone,
      phone2: (data.phone2 || "").trim() || null,
      email: data.email || null,
      city: (data.city || "").trim() || null,
      district: (data.district || "").trim() || null,
      address: (data.address || "").trim() || null,
      identityNumber: (data.identityNumber || "").trim() || null,
      taxNumber: (data.taxNumber || "").trim() || null,
      taxOffice: (data.taxOffice || "").trim() || null,
      notes: (data.notes || "").trim() || null,
      tag: (data.tag || "standard") as CustomerTag,
      source: (data.source || null) as CustomerSource | null,
      priceGroup: (data.priceGroup || "standard") as CustomerPriceGroup,
      discountRate: data.discountRate ?? 0,
      riskNote: (data.riskNote || "").trim() || null,
      whatsappConsent: !!data.whatsappConsent,
      smsConsent: !!data.smsConsent,
      emailConsent: !!data.emailConsent,
      kvkkApprovedAt: parseKvkkDate(data.kvkkApprovedAt),
    },
  })

  await AuditLogAction(user.workshopId, user.id, "Customer", customer.id, "customer_created")

  revalidatePath("/customers")
  revalidatePath("/customers/balances")
  return { success: true, id: customer.id }
}

export async function updateCustomerAction(customerId: string, formData: FormData) {
  const user = await requireAuth()

  const existing = await prisma.customer.findFirst({
    where: { id: customerId, workshopId: user.workshopId },
  })
  if (!existing) {
    return { error: "Müşteri bulunamadı veya bu iş yerine ait değil" }
  }

  const type = (formData.get("type") as string) || existing.type || "individual"
  const raw = {
    type,
    firstName: (formData.get("firstName") as string || "").trim(),
    lastName: (formData.get("lastName") as string || "").trim(),
    fullName: (formData.get("fullName") as string || "").trim(),
    companyName: (formData.get("companyName") as string || "").trim(),
    contactName: (formData.get("contactName") as string || "").trim(),
    phone: normalizePhone(formData.get("phone") as string || ""),
    phone2: normalizePhone(formData.get("phone2") as string || ""),
    email: (formData.get("email") as string || "").trim(),
    city: (formData.get("city") as string || "").trim(),
    district: (formData.get("district") as string || "").trim(),
    address: (formData.get("address") as string || "").trim(),
    identityNumber: (formData.get("identityNumber") as string || "").trim(),
    taxNumber: (formData.get("taxNumber") as string || "").trim(),
    taxOffice: (formData.get("taxOffice") as string || "").trim(),
    notes: (formData.get("notes") as string || "").trim(),
    tag: ((formData.get("tag") as string) || "standard") as CustomerTag,
    source: ((formData.get("source") as string) || "") as CustomerSource | "",
    priceGroup: ((formData.get("priceGroup") as string) || "standard") as CustomerPriceGroup,
    discountRate: (formData.get("discountRate") as string) || "0",
    riskNote: (formData.get("riskNote") as string || "").trim(),
    whatsappConsent: formData.get("whatsappConsent") === "on" || formData.get("whatsappConsent") === "true",
    smsConsent: formData.get("smsConsent") === "on" || formData.get("smsConsent") === "true",
    emailConsent: formData.get("emailConsent") === "on" || formData.get("emailConsent") === "true",
    kvkkApprovedAt: (formData.get("kvkkApprovedAt") as string) || "",
  }

  const parsed = customerCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  const data = parsed.data
  const customerType: CustomerType = data.type === "corporate" ? "corporate" : "individual"
  const firstName = customerType === "individual" ? (data.firstName || data.fullName || "").trim() || null : (data.contactName || "").trim() || null
  const lastName = customerType === "individual" ? (data.lastName || "").trim() || null : null
  const fullName = buildCustomerName({
    type: customerType,
    firstName: data.firstName,
    lastName: data.lastName,
    fullName: data.fullName,
    companyName: data.companyName,
  })
  const companyName = customerType === "corporate" ? (data.companyName || "").trim() || null : null

  await prisma.customer.update({
    where: { id: customerId, workshopId: user.workshopId },
    data: {
      type: customerType,
      firstName,
      lastName,
      fullName: fullName || null,
      companyName,
      contactName: customerType === "corporate" ? (data.contactName || "").trim() || null : null,
      phone: data.phone,
      phone2: (data.phone2 || "").trim() || null,
      email: data.email || null,
      city: (data.city || "").trim() || null,
      district: (data.district || "").trim() || null,
      address: (data.address || "").trim() || null,
      identityNumber: (data.identityNumber || "").trim() || null,
      taxNumber: (data.taxNumber || "").trim() || null,
      taxOffice: (data.taxOffice || "").trim() || null,
      notes: (data.notes || "").trim() || null,
      tag: (data.tag || "standard") as CustomerTag,
      source: (data.source || null) as CustomerSource | null,
      priceGroup: (data.priceGroup || "standard") as CustomerPriceGroup,
      discountRate: data.discountRate ?? 0,
      riskNote: (data.riskNote || "").trim() || null,
      whatsappConsent: !!data.whatsappConsent,
      smsConsent: !!data.smsConsent,
      emailConsent: !!data.emailConsent,
      kvkkApprovedAt: parseKvkkDate(data.kvkkApprovedAt),
    },
  })

  await AuditLogAction(user.workshopId, user.id, "Customer", customerId, "customer_updated")

  revalidatePath("/customers")
  revalidatePath(`/customers/${customerId}`)
  revalidatePath("/customers/balances")
  return { success: true, id: customerId }
}

export async function deleteCustomerAction(customerId: string) {
  const user = await requireAuth()
  const existing = await prisma.customer.findFirst({
    where: { id: customerId, workshopId: user.workshopId },
    include: {
      _count: {
        select: {
          vehicles: true,
          intakes: true,
          quotes: true,
          appointments: true,
          reminders: true,
          collections: true,
        },
      },
    },
  })
  if (!existing) {
    return { error: "Müşteri bulunamadı veya bu iş yerine ait değil" }
  }
  const related: string[] = []
  if (existing._count.vehicles > 0) related.push(`${existing._count.vehicles} araç`)
  if (existing._count.intakes > 0) related.push(`${existing._count.intakes} kabul kaydı`)
  if (existing._count.quotes > 0) related.push(`${existing._count.quotes} teklif`)
  if (existing._count.appointments > 0) related.push(`${existing._count.appointments} randevu`)
  if (existing._count.reminders > 0) related.push(`${existing._count.reminders} hatırlatma`)
  if (existing._count.collections > 0) related.push(`${existing._count.collections} tahsilat`)
  if (related.length > 0) {
    return {
      error: `Bu müşteriye bağlı ${related.join(", ")} var. Önce ilişkili kayıtları silmeniz gerekir.`,
    }
  }
  await prisma.customer.delete({
    where: { id: customerId, workshopId: user.workshopId },
  })
  await AuditLogAction(user.workshopId, user.id, "Customer", customerId, "customer_deleted")
  revalidatePath("/customers")
  revalidatePath("/customers/balances")
  return { success: true }
}

export async function getCustomersAction() {
  const user = await requireAuth()
  const customers = await prisma.customer.findMany({
    where: { workshopId: user.workshopId },
    orderBy: { createdAt: "desc" },
  })
  return customers
}

export async function searchCustomersAction(query: string) {
  const user = await requireAuth()
  const customers = await prisma.customer.findMany({
    where: {
      workshopId: user.workshopId,
      OR: [
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { fullName: { contains: query, mode: "insensitive" } },
        { companyName: { contains: query, mode: "insensitive" } },
        { contactName: { contains: query, mode: "insensitive" } },
        { phone: { contains: query } },
        { phone2: { contains: query } },
        { email: { contains: query, mode: "insensitive" } },
        { vehicles: { some: { plate: { contains: query, mode: "insensitive" } } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  })
  return customers
}

export type CustomerListFilter = {
  q?: string
  type?: "individual" | "corporate" | ""
  tag?: string
  source?: string
}

export async function listCustomersForWorkshop(
  filter: CustomerListFilter
) {
  const { workshopId } = await requireAuth()
  const where: Prisma.CustomerWhereInput = { workshopId }
  if (filter.q && filter.q.trim()) {
    const q = filter.q.trim()
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { fullName: { contains: q, mode: "insensitive" } },
      { companyName: { contains: q, mode: "insensitive" } },
      { contactName: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { phone2: { contains: q } },
      { email: { contains: q, mode: "insensitive" } },
      { vehicles: { some: { plate: { contains: q, mode: "insensitive" } } } },
    ]
  }
  if (filter.type === "individual" || filter.type === "corporate") {
    where.type = filter.type
  }
  if (filter.tag) {
    where.tag = filter.tag as CustomerTag
  }
  if (filter.source) {
    where.source = filter.source as CustomerSource
  }

  return prisma.customer.findMany({
    where,
    include: {
      _count: { select: { vehicles: true, intakes: true } },
      vehicles: { select: { id: true, plate: true } },
      intakes: {
        select: {
          id: true,
          order: {
            select: {
              id: true,
              workOrderNo: true,
              status: true,
              paymentStatus: true,
              items: { select: { totalPrice: true, unitPrice: true, quantity: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })
}
