import type { ChecklistCategory } from "@prisma/client"

/**
 * Sabit sistem şablonu: teknisyene atanan her iş emrinde otomatik oluşan
 * jenerik kontrol maddeleri. Atölye-özel şablon bilinçli olarak kapsam dışı —
 * önce bu sabit set sahada denenecek.
 *
 * `key` KALICI bir sözleşmedir: seed idempotanlığı ve "zorunlu madde silinemez"
 * kuralı buna dayanır. Var olan bir anahtarı DEĞİŞTİRME (eski iş emirlerinde
 * kopya madde üretir); metni düzeltmek serbesttir, anahtarı sabit bırak.
 */
export interface ChecklistTemplateItem {
  key: string
  category: ChecklistCategory
  description: string
}

export const CHECKLIST_TEMPLATE: ChecklistTemplateItem[] = [
  // Kontrol — araç teslim alınırken
  { key: "inspection.mileage_fuel", category: "inspection", description: "Araç KM ve yakıt seviyesi kaydedildi" },
  { key: "inspection.visible_damage", category: "inspection", description: "Görünür hasar/çizik kontrol edildi" },
  { key: "inspection.complaint_confirmed", category: "inspection", description: "Müşteri şikayeti araç üzerinde teyit edildi" },
  { key: "inspection.personal_items", category: "inspection", description: "Araç içi kişisel eşya kontrolü yapıldı" },
  { key: "inspection.fluid_levels", category: "inspection", description: "Motor yağı ve soğutma sıvısı seviyeleri kontrol edildi" },
  { key: "inspection.battery", category: "inspection", description: "Akü ve şarj durumu kontrol edildi" },
  { key: "inspection.tires", category: "inspection", description: "Lastik durumu ve hava basıncı kontrol edildi" },
  { key: "inspection.brakes", category: "inspection", description: "Fren balata/disk gözle kontrol edildi" },

  // Onarım
  { key: "repair.items_done", category: "repair", description: "İş emrindeki tüm parça ve işçilik kalemleri tamamlandı" },
  { key: "repair.old_parts_kept", category: "repair", description: "Sökülen parçalar müşteriye gösterilmek üzere ayrıldı" },
  { key: "repair.retested", category: "repair", description: "Arıza tekrar test edildi, giderildiği doğrulandı" },
  { key: "repair.fault_codes", category: "repair", description: "Hata kodu / uyarı lambası kontrolü yapıldı" },

  // Teslim
  { key: "delivery.road_test", category: "delivery", description: "Yol testi yapıldı" },
  { key: "delivery.leak_check", category: "delivery", description: "Sıvı kaçağı kontrolü yapıldı" },
  { key: "delivery.cleanup", category: "delivery", description: "Araç içi/dışı temizlik yapıldı, aletler toplandı" },
  { key: "delivery.customer_summary", category: "delivery", description: "Yapılan işlemler müşteriye aktarılacak şekilde özetlendi" },
]

const ORDER_BY_KEY = new Map(CHECKLIST_TEMPLATE.map((t, i) => [t.key, i]))

/** Şablondaki sabit sıra — listede kategori blokları bozulmasın diye. */
export function templateSortOrder(key: string): number {
  return ORDER_BY_KEY.get(key) ?? 0
}

/** Şablondan, verilen iş emrinde HENÜZ olmayan maddeler. */
export function missingTemplateItems(existingKeys: string[]): ChecklistTemplateItem[] {
  const seen = new Set(existingKeys)
  return CHECKLIST_TEMPLATE.filter((t) => !seen.has(t.key))
}
