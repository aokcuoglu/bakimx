/**
 * Silinmiş kontrol maddelerini gizleyen ortak Prisma filtresi.
 *
 * Kontrol maddesi silme SOFT'tur ve yalnızca o iş emrini etkiler: satır
 * `deletedAt` ile mezar taşına döner, çünkü seed "şablondan gelen bu madde bu
 * iş emrinde VAR mı" sorusunu `templateKey` üzerinden cevaplar — satır gerçekten
 * silinseydi silinen madde bir sonraki okumada geri gelirdi. Yeni iş emirleri
 * şablonun tamamını almaya devam eder; silme şablonu değiştirmez.
 *
 * Bu yüzden kontrol maddesi OKUYAN her sorgu bu filtreyi kullanmak zorunda;
 * unutulursa silinen madde listede/ilerleme sayısında geri görünür ve
 * TypeScript bunu yakalayamaz (alan opsiyonel). `checklist-visibility.test.ts`
 * kaynak taramasıyla filtreyi zorunlu kılar.
 *
 * Kullanım:
 *   checklistItems: { where: ACTIVE_CHECKLIST_ITEM, orderBy: { sortOrder: "asc" } }
 *   prisma.checklistItem.findMany({ where: { serviceOrderId, ...ACTIVE_CHECKLIST_ITEM } })
 */
export const ACTIVE_CHECKLIST_ITEM = { deletedAt: null } as const

/** Bellekte ayıklama — sorgu filtresinin bellek karşılığı. */
export function isActiveChecklistItem<T extends { deletedAt?: Date | string | null }>(
  item: T
): boolean {
  return !item.deletedAt
}
