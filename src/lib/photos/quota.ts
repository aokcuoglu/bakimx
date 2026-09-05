import { prisma } from "@/lib/db"
import { VISIBLE_PHOTO } from "@/lib/intake/photo-visibility"
import { MAX_ACTIVE_PHOTOS_PER_INTAKE } from "@/lib/photos/limits"
import type { Prisma } from "@prisma/client"

type PhotoQuotaClient = Pick<Prisma.TransactionClient, "vehiclePhoto">

/**
 * Kabul formundaki aktif (silinmemiş) fotoğraf sayısını kontrol eder.
 * Dış alım / kanıt / OCR kareleri aynı kotayı paylaşır.
 */
export async function assertIntakePhotoQuota(
  workshopId: string,
  intakeFormId: string,
  adding = 1,
  database: PhotoQuotaClient = prisma,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const active = await database.vehiclePhoto.count({
    where: {
      workshopId,
      intakeFormId,
      ...VISIBLE_PHOTO,
    },
  })

  if (active + adding > MAX_ACTIVE_PHOTOS_PER_INTAKE) {
    return {
      ok: false,
      error: `Bu iş emrine en fazla ${MAX_ACTIVE_PHOTOS_PER_INTAKE} fotoğraf eklenebilir (şu an ${active}). Gereksiz kareleri silip tekrar deneyin.`,
    }
  }

  return { ok: true }
}
