"use server"

import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { nanoid } from "nanoid"
import { AuditLogAction } from "@/lib/audit"

export async function createPassportTokenAction(vehicleId: string, data: {
  label?: string
  expiresAt?: string
  showServiceHistory?: boolean
  showWorkOrders?: boolean
  showDamages?: boolean
  showPhotos?: boolean
  showReminders?: boolean
  showPaymentStatus?: boolean
}) {
  const user = await requireAuth()

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, workshopId: user.workshopId },
  })
  if (!vehicle) return { error: "Araç bulunamadı" }

  const token = nanoid(32)

  const passportToken = await prisma.vehiclePassportToken.create({
    data: {
      workshopId: user.workshopId,
      vehicleId,
      token,
      label: data.label || null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      showServiceHistory: data.showServiceHistory ?? true,
      showWorkOrders: data.showWorkOrders ?? true,
      showDamages: data.showDamages ?? true,
      showPhotos: data.showPhotos ?? true,
      showReminders: data.showReminders ?? true,
      showPaymentStatus: data.showPaymentStatus ?? false,
    },
  })

  await AuditLogAction(user.workshopId, user.id, "VehiclePassportToken", passportToken.id, "passport_token_created", JSON.stringify({ vehicleId, token }))

  revalidatePath(`/app/vehicles/${vehicleId}/passport`)
  return { success: true, token: passportToken.token }
}

export async function updatePassportTokenAction(tokenId: string, vehicleId: string, data: {
  label?: string
  isActive?: boolean
  expiresAt?: string | null
  showServiceHistory?: boolean
  showWorkOrders?: boolean
  showDamages?: boolean
  showPhotos?: boolean
  showReminders?: boolean
  showPaymentStatus?: boolean
}) {
  const user = await requireAuth()

  const existing = await prisma.vehiclePassportToken.findFirst({
    where: { id: tokenId, workshopId: user.workshopId, vehicleId },
  })
  if (!existing) return { error: "Pasaport token bulunamadı" }

  const updateData: Record<string, unknown> = {}
  if (data.label !== undefined) updateData.label = data.label
  if (data.isActive !== undefined) updateData.isActive = data.isActive
  if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null
  if (data.showServiceHistory !== undefined) updateData.showServiceHistory = data.showServiceHistory
  if (data.showWorkOrders !== undefined) updateData.showWorkOrders = data.showWorkOrders
  if (data.showDamages !== undefined) updateData.showDamages = data.showDamages
  if (data.showPhotos !== undefined) updateData.showPhotos = data.showPhotos
  if (data.showReminders !== undefined) updateData.showReminders = data.showReminders
  if (data.showPaymentStatus !== undefined) updateData.showPaymentStatus = data.showPaymentStatus

  await prisma.vehiclePassportToken.update({
    where: { id: tokenId },
    data: updateData,
  })

  await AuditLogAction(user.workshopId, user.id, "VehiclePassportToken", tokenId, "passport_token_updated", JSON.stringify({ vehicleId, updates: data }))

  revalidatePath(`/app/vehicles/${vehicleId}/passport`)
  return { success: true }
}

export async function deletePassportTokenAction(tokenId: string, vehicleId: string) {
  const user = await requireAuth()

  const existing = await prisma.vehiclePassportToken.findFirst({
    where: { id: tokenId, workshopId: user.workshopId, vehicleId },
  })
  if (!existing) return { error: "Pasaport token bulunamadı" }

  await prisma.vehiclePassportToken.delete({ where: { id: tokenId } })

  await AuditLogAction(user.workshopId, user.id, "VehiclePassportToken", tokenId, "passport_token_deleted", JSON.stringify({ vehicleId }))

  revalidatePath(`/app/vehicles/${vehicleId}/passport`)
  return { success: true }
}