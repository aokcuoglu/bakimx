"use server"

import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { vehicleCreateSchema } from "@/lib/validation"
import { revalidatePath } from "next/cache"
import { AuditLogAction } from "@/lib/audit"
import { normalizePlate } from "@/lib/format"

export async function createVehicleAction(formData: FormData) {
  const user = await requireAuth()

  const raw = {
    customerId: formData.get("customerId") as string,
    plate: normalizePlate(formData.get("plate") as string || ""),
    brand: (formData.get("brand") as string || "").trim(),
    model: (formData.get("model") as string || "").trim(),
    vehicleType: (formData.get("vehicleType") as string || "").trim(),
    modelYear: formData.get("modelYear") as string,
    mileage: formData.get("mileage") as string,
    vin: (formData.get("vin") as string || "").trim(),
  }

  const parsed = vehicleCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  const customer = await prisma.customer.findFirst({
    where: { id: parsed.data.customerId, workshopId: user.workshopId },
  })
  if (!customer) {
    return { error: "Müşteri bulunamadı" }
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      workshopId: user.workshopId,
      customerId: parsed.data.customerId,
      plate: parsed.data.plate.toUpperCase(),
      brand: parsed.data.brand,
      model: parsed.data.model,
      vehicleType: parsed.data.vehicleType || null,
      modelYear: parsed.data.modelYear || null,
      mileage: parsed.data.mileage || null,
      vin: parsed.data.vin || null,
    },
  })

  await AuditLogAction(user.workshopId, user.id, "Vehicle", vehicle.id, "vehicle_created")

  revalidatePath("/app/vehicles")
  return { success: true, id: vehicle.id }
}

export async function getVehiclesAction() {
  const user = await requireAuth()
  const vehicles = await prisma.vehicle.findMany({
    where: { workshopId: user.workshopId },
    include: { customer: true },
    orderBy: { createdAt: "desc" },
  })
  return vehicles
}
