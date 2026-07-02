"use server"

import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { vehicleCreateSchema, vehicleUpdateSchema } from "@/lib/validations/vehicle"
import { revalidatePath } from "next/cache"
import { AuditLogAction } from "@/lib/audit"
import { normalizePlate } from "@/lib/format"

/**
 * The catalog id columns have no DB foreign keys (the catalog is re-importable
 * reference data), so this single indexed lookup is the integrity guard.
 * Only our own UI sends these ids — a mismatch means a bug worth surfacing,
 * hence reject instead of silently nulling.
 */
async function validateCatalogSelection(data: {
  catalogBrandId?: number
  catalogModelId?: number
  catalogVehicleTypeId?: number
}): Promise<string | null> {
  const { catalogBrandId, catalogModelId, catalogVehicleTypeId } = data
  if (catalogVehicleTypeId) {
    const ok = await prisma.vehicleType.findFirst({
      where: {
        id: catalogVehicleTypeId,
        ...(catalogModelId ? { modelId: catalogModelId } : {}),
        ...(catalogBrandId ? { model: { brandId: catalogBrandId } } : {}),
      },
      select: { id: true },
    })
    if (!ok) return "Araç katalog seçimi tutarsız. Lütfen marka/model seçimini yenileyin."
    return null
  }
  if (catalogModelId) {
    const ok = await prisma.vehicleModel.findFirst({
      where: { id: catalogModelId, ...(catalogBrandId ? { brandId: catalogBrandId } : {}) },
      select: { id: true },
    })
    if (!ok) return "Araç katalog seçimi tutarsız. Lütfen marka/model seçimini yenileyin."
    return null
  }
  if (catalogBrandId) {
    const ok = await prisma.vehicleBrand.findUnique({ where: { id: catalogBrandId }, select: { id: true } })
    if (!ok) return "Araç katalog seçimi tutarsız. Lütfen marka/model seçimini yenileyin."
  }
  return null
}

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
    commercialName: (formData.get("commercialName") as string || "").trim(),
    firstRegistrationDate: (formData.get("firstRegistrationDate") as string || "").trim(),
    engineDisplacement: (formData.get("engineDisplacement") as string || "").trim(),
    enginePower: (formData.get("enginePower") as string || "").trim(),
    inspectionValidUntil: (formData.get("inspectionValidUntil") as string || "").trim(),
    catalogBrandId: (formData.get("catalogBrandId") as string) || undefined,
    catalogModelId: (formData.get("catalogModelId") as string) || undefined,
    catalogVehicleTypeId: (formData.get("catalogVehicleTypeId") as string) || undefined,
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

  const catalogError = await validateCatalogSelection(parsed.data)
  if (catalogError) return { error: catalogError }

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
        commercialName: parsed.data.commercialName || null,
        firstRegistrationDate: parsed.data.firstRegistrationDate || null,
        engineDisplacement: parsed.data.engineDisplacement || null,
        enginePower: parsed.data.enginePower || null,
        inspectionValidUntil: parsed.data.inspectionValidUntil || null,
        catalogBrandId: parsed.data.catalogBrandId ?? null,
        catalogModelId: parsed.data.catalogModelId ?? null,
        catalogVehicleTypeId: parsed.data.catalogVehicleTypeId ?? null,
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
    commercialName: (formData.get("commercialName") as string || "").trim(),
    firstRegistrationDate: (formData.get("firstRegistrationDate") as string || "").trim(),
    engineDisplacement: (formData.get("engineDisplacement") as string || "").trim(),
    enginePower: (formData.get("enginePower") as string || "").trim(),
    inspectionValidUntil: (formData.get("inspectionValidUntil") as string || "").trim(),
    catalogBrandId: (formData.get("catalogBrandId") as string) || undefined,
    catalogModelId: (formData.get("catalogModelId") as string) || undefined,
    catalogVehicleTypeId: (formData.get("catalogVehicleTypeId") as string) || undefined,
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

  const catalogError = await validateCatalogSelection(parsed.data)
  if (catalogError) return { error: catalogError }

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
      commercialName: parsed.data.commercialName || null,
      firstRegistrationDate: parsed.data.firstRegistrationDate || null,
      engineDisplacement: parsed.data.engineDisplacement || null,
      enginePower: parsed.data.enginePower || null,
      inspectionValidUntil: parsed.data.inspectionValidUntil || null,
      catalogBrandId: parsed.data.catalogBrandId ?? null,
      catalogModelId: parsed.data.catalogModelId ?? null,
      catalogVehicleTypeId: parsed.data.catalogVehicleTypeId ?? null,
      notes: parsed.data.notes || null,
    },
  })

  await AuditLogAction(user.workshopId, user.id, "Vehicle", vehicleId, "vehicle_updated")

  revalidatePath("/vehicles")
  revalidatePath(`/vehicles/${vehicleId}`)
  return { success: true }
}

export async function confirmVehicleVinAction(vehicleId: string) {
  const user = await requireAuth()

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, workshopId: user.workshopId },
  })
  if (!vehicle) return { error: "Araç bulunamadı" }
  if (!vehicle.vin) return { error: "Önce şase numarası girilmeli" }
  if (vehicle.vinConfirmed) return { success: true as const }

  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: { vinConfirmed: true },
  })

  await AuditLogAction(user.workshopId, user.id, "Vehicle", vehicleId, "vehicle_vin_confirmed")

  revalidatePath("/vehicles")
  revalidatePath(`/vehicles/${vehicleId}`)
  return { success: true as const }
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

export async function changeVehicleOwnerAction(vehicleId: string, newCustomerId: string) {
  const user = await requireAuth()

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, workshopId: user.workshopId },
  })
  if (!vehicle) return { error: "Araç bulunamadı" }

  const customer = await prisma.customer.findFirst({
    where: { id: newCustomerId, workshopId: user.workshopId },
  })
  if (!customer) return { error: "Müşteri bulunamadı" }

  if (vehicle.customerId === newCustomerId) {
    return { success: true as const, id: vehicleId }
  }

  await prisma.vehicle.updateMany({
    where: { id: vehicleId, workshopId: user.workshopId },
    data: { customerId: newCustomerId },
  })

  await AuditLogAction(user.workshopId, user.id, "Vehicle", vehicleId, "vehicle_owner_changed")

  revalidatePath("/vehicles")
  revalidatePath(`/vehicles/${vehicleId}`)
  return { success: true as const, id: vehicleId }
}
