import type { Prisma } from "@prisma/client"
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
