"use server"

import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { businessProfileSchema } from "@/lib/validations/settings"
import { revalidatePath } from "next/cache"

export async function updateWorkshopAction(formData: FormData) {
  const user = await requireAuth()

  const raw = {
    name: formData.get("name") as string,
    phone: formData.get("phone") as string,
    city: formData.get("city") as string,
    district: formData.get("district") as string,
    address: formData.get("address") as string,
    email: formData.get("email") as string,
    website: formData.get("website") as string,
    logoUrl: formData.get("logoUrl") as string,
    taxNumber: formData.get("taxNumber") as string,
    taxOffice: formData.get("taxOffice") as string,
    invoiceTitle: formData.get("invoiceTitle") as string,
  }

  const parsed = businessProfileSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  await prisma.workshop.update({
    where: { id: user.workshopId },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      city: parsed.data.city,
      district: parsed.data.district || null,
      address: parsed.data.address,
      email: parsed.data.email || null,
      website: parsed.data.website || null,
      logoUrl: parsed.data.logoUrl || null,
      taxNumber: parsed.data.taxNumber || null,
      taxOffice: parsed.data.taxOffice || null,
      invoiceTitle: parsed.data.invoiceTitle || null,
    },
  })

  revalidatePath("/workshop")
  revalidatePath("/settings")
  return { success: true }
}