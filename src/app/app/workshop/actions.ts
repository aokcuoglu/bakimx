"use server"

import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { workshopUpdateSchema } from "@/lib/validation"
import { revalidatePath } from "next/cache"

export async function updateWorkshopAction(formData: FormData) {
  const user = await requireAuth()

  const raw = {
    name: formData.get("name") as string,
    phone: formData.get("phone") as string,
    city: formData.get("city") as string,
    address: formData.get("address") as string,
    logoUrl: formData.get("logoUrl") as string,
    taxNumber: formData.get("taxNumber") as string,
    invoiceTitle: formData.get("invoiceTitle") as string,
  }

  const parsed = workshopUpdateSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  await prisma.workshop.update({
    where: { id: user.workshopId },
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone,
      city: parsed.data.city,
      address: parsed.data.address,
      logoUrl: parsed.data.logoUrl || null,
      taxNumber: parsed.data.taxNumber || null,
      invoiceTitle: parsed.data.invoiceTitle || null,
    },
  })

  revalidatePath("/app/workshop")
  return { success: true }
}