import type { OrderStatus, Prisma, PrismaClient } from "@prisma/client"
import { isOrderLocked } from "../status-transitions"
import { missingTemplateItems, templateSortOrder } from "./checklist-template"

/**
 * İş emrine sistem şablonundaki eksik kontrol maddelerini ekler.
 *
 * İdempotent: var olan `templateKey`ler atlanır — yeniden atama veya usta
 * değişikliği madde çoğaltmaz, işaretlenmiş maddeleri sıfırlamaz.
 * Satır-başına upsert yerine tek `createMany` (transaction süresi kritik).
 * `(serviceOrderId, templateKey)` üzerindeki DB unique kısıtı eşzamanlı iki
 * atamaya karşı son savunma hattı — `skipDuplicates` bu durumda sessizce
 * atlar, gerçek eklenen sayıyı `.count`'tan döndürürüz (read-then-write
 * `missing.length` yarışta sapabilir).
 */
export async function seedChecklistFromTemplate(
  tx: Prisma.TransactionClient,
  workshopId: string,
  serviceOrderId: string
): Promise<number> {
  const existing = await tx.checklistItem.findMany({
    where: { workshopId, serviceOrderId, templateKey: { not: null } },
    select: { templateKey: true },
  })

  const missing = missingTemplateItems(
    existing.map((e) => e.templateKey).filter((k): k is string => k !== null)
  )
  if (missing.length === 0) return 0

  const result = await tx.checklistItem.createMany({
    data: missing.map((t) => ({
      workshopId,
      serviceOrderId,
      category: t.category,
      description: t.description,
      isRequired: true,
      templateKey: t.key,
      sortOrder: templateSortOrder(t.key),
    })),
    skipDuplicates: true,
  })

  return result.count
}

/** `shouldSeedChecklist` için gereken en küçük iş emri şekli. */
export interface SeedCandidateOrder {
  status: OrderStatus
  assignedTechnicianId: string | null
}

/**
 * Şablon maddeleri bu iş emrinde tamamlanmalı mı?
 *
 * Seed uzun süre yalnızca atama anında çalıştı; özellikten ÖNCE atanmış iş
 * emirleri bu yüzden kalıcı olarak boş kaldı ve boş liste kapıyı da açtı
 * (`countBlockingChecklist` var olan kayıtları sayar → 0 madde = 0 engel).
 * Aynı şey şablona yeni madde eklendiğinde de olurdu. Karar burada saf tutulur
 * ki hem okuma yolları hem kapılar aynı cevabı versin.
 */
export function shouldSeedChecklist(
  order: SeedCandidateOrder,
  existingTemplateKeys: (string | null)[]
): boolean {
  if (!order.assignedTechnicianId) return false
  // Kilitli iş emrinde madde üretmek kapanmış bir işi "eksik" gösterirdi.
  if (isOrderLocked(order.status)) return false
  return missingTemplateItems(existingTemplateKeys.filter((k): k is string => k !== null)).length > 0
}

/**
 * Eksik şablon maddelerini tamamlar. Dönen `true`, çağıranın kontrol listesini
 * yeniden okuması gerektiğini söyler (elindeki liste artık eksik).
 *
 * Çağrı yerleri bilinçli olarak hem okuma (teknisyen detay sayfası) hem yazma
 * (işe başla / tamamla kapıları) tarafında: kapı tek başına güvenliği sağlar,
 * sayfa ise teknisyene listeyi ilk açılışta gösterir.
 */
export async function ensureChecklistSeeded(
  db: Pick<PrismaClient, "$transaction">,
  workshopId: string,
  order: SeedCandidateOrder & { id: string },
  existingTemplateKeys: (string | null)[]
): Promise<boolean> {
  if (!shouldSeedChecklist(order, existingTemplateKeys)) return false
  const seeded = await db.$transaction((tx) => seedChecklistFromTemplate(tx, workshopId, order.id))
  return seeded > 0
}
