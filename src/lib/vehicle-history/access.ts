/**
 * Servisler arası araç geçmişinde (BAK-77) maskeyi kim kaldırabilir.
 *
 * İki kaynak vardır ve İKİSİ DE bir servis ilişkisinin kanıtıdır:
 *
 * 1. **Ruhsat taraması** (`VehicleHistoryGrant`) — araç bu atölyeye ilk kez
 *    geliyor olsa bile, ruhsatı elde tutmak maskeyi kaldırır. Kullanıcının
 *    isteğindeki asıl kural budur.
 * 2. **Kendi kaydı** — atölyenin bu plaka için zaten bir kabul formu (yani
 *    gerçekten servis ettiği bir geçmiş) varsa maske aranmaz.
 *
 * Yalnız araç kartı açmış olmak YETMEZ: `Vehicle` satırı elle de yaratılabilir,
 * plakayı yazan herkes geçmişi açabilseydi maskenin anlamı kalmazdı. Bu yüzden
 * ikinci kaynak `Vehicle` değil `VehicleIntakeForm` üzerinden ölçülür.
 */

import { prisma } from "@/lib/db"
import { normalizePlate } from "@/lib/format"
import { AuditLogAction } from "@/lib/audit"
import type { VehicleHistoryAccessReason } from "./types"

export async function resolveVehicleHistoryAccess(
  workshopId: string,
  plate: string
): Promise<VehicleHistoryAccessReason | null> {
  const normalized = normalizePlate(plate)
  if (!normalized) return null

  const grant = await prisma.vehicleHistoryGrant.findUnique({
    where: { workshopId_plate: { workshopId, plate: normalized } },
    select: { id: true },
  })
  if (grant) return "registration_scan"

  const ownIntake = await prisma.vehicleIntakeForm.findFirst({
    where: { workshopId, vehicle: { plate: normalized } },
    select: { id: true },
  })
  return ownIntake ? "own_record" : null
}

/**
 * Ruhsat okutulduğunda hakkı kaydeder. Idempotent — aynı plaka tekrar
 * taranırsa ilk tarama kaydı korunur (hakkın ne zaman doğduğu denetim izidir).
 *
 * Sessizce başarısız olur: OCR akışının kendisi bu yan etki yüzünden
 * düşmemeli. Hak doğmazsa kullanıcı yalnız maskeli görür, veri sızmaz.
 */
export async function grantVehicleHistoryAccess({
  workshopId,
  plate,
  vin,
  userId,
  ocrLogId,
}: {
  workshopId: string
  plate: string
  vin?: string | null
  userId?: string | null
  ocrLogId?: string | null
}): Promise<boolean> {
  const normalized = normalizePlate(plate)
  // Türkiye plakaları en kısa hâlde 5 karakter ("34AB12"dan kısası yok);
  // OCR yarım okuduğunda çöp anahtarla hak açmayalım.
  if (normalized.length < 5) return false

  try {
    const existing = await prisma.vehicleHistoryGrant.findUnique({
      where: { workshopId_plate: { workshopId, plate: normalized } },
      select: { id: true },
    })
    if (existing) return true

    const grant = await prisma.vehicleHistoryGrant.create({
      data: {
        workshopId,
        plate: normalized,
        vin: vin?.trim() ? vin.trim().toUpperCase() : null,
        grantedByUserId: userId ?? null,
        ocrLogId: ocrLogId ?? null,
      },
    })

    // KVKK açısından "maske ne zaman, kim tarafından, hangi kanıtla kalktı"
    // sorusunun cevabı denetlenebilir olmalı.
    await AuditLogAction(
      workshopId,
      userId ?? undefined,
      "VehicleHistoryGrant",
      grant.id,
      "vehicle_history_unlock",
      JSON.stringify({ plate: normalized, ocrLogId: ocrLogId ?? null })
    )
    return true
  } catch {
    return false
  }
}
