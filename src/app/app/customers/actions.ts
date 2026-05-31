"use server"

import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { customerCreateSchema } from "@/lib/validation"
import { revalidatePath } from "next/cache"
import { AuditLogAction } from "@/lib/audit"
import { normalizePhone } from "@/lib/format"

export async function createCustomerAction(formData: FormData) {
  const user = await requireAuth()

  const raw = {
    firstName: (formData.get("firstName") as string || "").trim(),
    lastName: (formData.get("lastName") as string || "").trim(),
    phone: normalizePhone(formData.get("phone") as string || ""),
    email: (formData.get("email") as string || "").trim(),
  }

  const parsed = customerCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  const customer = await prisma.customer.create({
    data: {
      workshopId: user.workshopId,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
    },
  })

  await AuditLogAction(user.workshopId, user.id, "Customer", customer.id, "customer_created")

  revalidatePath("/app/customers")
  return { success: true, id: customer.id }
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
        { phone: { contains: query } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  })
  return customers
}
