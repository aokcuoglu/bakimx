import { VISIBLE_PHOTO } from "./photo-visibility"
import type { Prisma } from "@prisma/client"

export const VISIBLE_DAMAGE = { deletedAt: null } as const
export const DAMAGE_PHOTOS = { photos: { where: { photo: { ...VISIBLE_PHOTO, serviceOrderItemId: null } }, select: { photoId: true } } } as const
export function damageDto(mark: { id: string; number: number; zone: string; damageType: string; severity: string; note: string | null; photos: { photoId: string }[] }) {
  return { id: mark.id, number: mark.number, zone: mark.zone, damageType: mark.damageType, severity: mark.severity, note: mark.note, photoIds: mark.photos.map(p => p.photoId) }
}
/** Lock the parent before number allocation, inspection transitions and damage mutations. */
export async function lockDamageIntake(tx: Prisma.TransactionClient, id: string, workshopId: string) {
  await tx.$queryRaw`SELECT "id" FROM "ServiceOrder" WHERE "intakeFormId" = ${id} AND "workshopId" = ${workshopId} FOR UPDATE`
  await tx.$queryRaw`SELECT "id" FROM "VehicleIntakeForm" WHERE "id" = ${id} AND "workshopId" = ${workshopId} FOR UPDATE`
}
export async function validateDamagePhotos(tx: Prisma.TransactionClient, ids: string[], intakeFormId: string, workshopId: string) {
  const unique = [...new Set(ids)]
  const count = await tx.vehiclePhoto.count({ where: { id: { in: unique }, intakeFormId, workshopId, ...VISIBLE_PHOTO, serviceOrderItemId: null } })
  if (count !== unique.length) throw new InvalidDamagePhotoError("Fotoğraf bu kabul kaydına ait değil veya kaldırılmış")
  return unique
}

export class InvalidDamagePhotoError extends Error {}
