"use server"

import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { vehicleCreateSchema, vehicleUpdateSchema } from "@/lib/validations/vehicle"
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
    modelYear: (formData.get("modelYear") as string) || undefined,
    mileage: (formData.get("mileage") as string) || undefined,
    vin: (formData.get("vin") as string || "").trim(),
    vinConfirmed: formData.get("vinConfirmed") === "on",
    color: (formData.get("color") as string || "").trim(),
    engineNo: (formData.get("engineNo") as string || "").trim(),
    fuelType: (formData.get("fuelType") as string || "").trim(),
    transmission: (formData.get("transmission") as string || "").trim(),
    notes: (formData.get("notes") as string || "").trim(),
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

  try {
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
        vinConfirmed: parsed.data.vinConfirmed ?? false,
        color: parsed.data.color || null,
        engineNo: parsed.data.engineNo || null,
        fuelType: parsed.data.fuelType || null,
        transmission: parsed.data.transmission || null,
        notes: parsed.data.notes || null,
      },
    })

    await AuditLogAction(user.workshopId, user.id, "Vehicle", vehicle.id, "vehicle_created")

    revalidatePath("/vehicles")
    return { success: true, id: vehicle.id }
  } catch (createError: unknown) {
    if (
      createError instanceof Error &&
      (createError.message.includes("Unique constraint") ||
        createError.message.includes("UniqueConstraint"))
    ) {
      return {
        error:
          "Bu plaka ile kayıtlı bir araç zaten var. " +
          "Lütfen mevcut aracı düzenleyin veya farklı bir plaka girin.",
      }
    }
    throw createError
  }
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

export async function getVehicleAction(vehicleId: string) {
  const user = await requireAuth()
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, workshopId: user.workshopId },
    include: {
      customer: true,
      intakes: {
        include: {
          order: { include: { items: true } },
          damageMarks: true,
          photos: { select: { id: true, type: true, label: true, fileUrl: true, createdAt: true } },
          approvals: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  })
  if (!vehicle) return null
  return vehicle
}

export async function updateVehicleAction(vehicleId: string, formData: FormData) {
  const user = await requireAuth()

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, workshopId: user.workshopId },
  })
  if (!vehicle) return { error: "Araç bulunamadı" }

  const raw = {
    customerId: formData.get("customerId") as string,
    plate: normalizePlate(formData.get("plate") as string || ""),
    brand: (formData.get("brand") as string || "").trim(),
    model: (formData.get("model") as string || "").trim(),
    vehicleType: (formData.get("vehicleType") as string || "").trim(),
    modelYear: (formData.get("modelYear") as string) || undefined,
    mileage: (formData.get("mileage") as string) || undefined,
    vin: (formData.get("vin") as string || "").trim(),
    vinConfirmed: formData.get("vinConfirmed") === "on",
    color: (formData.get("color") as string || "").trim(),
    engineNo: (formData.get("engineNo") as string || "").trim(),
    fuelType: (formData.get("fuelType") as string || "").trim(),
    transmission: (formData.get("transmission") as string || "").trim(),
    notes: (formData.get("notes") as string || "").trim(),
  }

  const parsed = vehicleUpdateSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Geçersiz bilgiler" }
  }

  const customer = await prisma.customer.findFirst({
    where: { id: parsed.data.customerId, workshopId: user.workshopId },
  })
  if (!customer) {
    return { error: "Müşteri bulunamadı" }
  }

  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: {
      customerId: parsed.data.customerId,
      plate: parsed.data.plate.toUpperCase(),
      brand: parsed.data.brand,
      model: parsed.data.model,
      vehicleType: parsed.data.vehicleType || null,
      modelYear: parsed.data.modelYear || null,
      mileage: parsed.data.mileage || null,
      vin: parsed.data.vin || null,
      vinConfirmed: parsed.data.vinConfirmed ?? false,
      color: parsed.data.color || null,
      engineNo: parsed.data.engineNo || null,
      fuelType: parsed.data.fuelType || null,
      transmission: parsed.data.transmission || null,
      notes: parsed.data.notes || null,
    },
  })

  await AuditLogAction(user.workshopId, user.id, "Vehicle", vehicleId, "vehicle_updated")

  revalidatePath("/vehicles")
  revalidatePath(`/vehicles/${vehicleId}`)
  return { success: true }
}

export async function deleteVehicleAction(vehicleId: string) {
  const user = await requireAuth()

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, workshopId: user.workshopId },
    include: { intakes: { take: 1 } },
  })
  if (!vehicle) return { error: "Araç bulunamadı" }
  if (vehicle.intakes.length > 0) {
    return { error: "Bu araca bağlı araç kabul kayıtları bulunuyor. Önce kabul kayıtlarını silmelisiniz." }
  }

  await prisma.vehicle.delete({ where: { id: vehicleId } })

  await AuditLogAction(user.workshopId, user.id, "Vehicle", vehicleId, "vehicle_deleted")

  revalidatePath("/vehicles")
  return { success: true }
}
