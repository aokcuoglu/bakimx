/**
 * Teknisyen panelindeki "Parça & İşçilik" bölümünün görünürlük kararı (BAK-141).
 *
 * Saha ekibi artık iş emrine doğrudan parça / işçilik / dış işçilik girebiliyor;
 * bunu ofis tarafındaki AYNI düzenleyiciyle yapıyor (`PartsLaborGrid` — bkz.
 * `src/components/technician/technician-parts-labor-section.tsx`). Yazma kapısı
 * bu yüzden YENİ bir izin değil, #183'ten beri var olan `order.edit`:
 *
  *  - `usta` / `staff` / `manager` / `owner` → `order.edit` taşır, düzenleyiciyi görür.
  *  - `cirak`                                → yalnız `parts.purchase` taşır; iş emri
  *    kalemi ekleyemez, ancak "Dış Alımlar" sekmesinden parça alımı kaydedebilir.
 *
 * Sunucu kapısı `addOrderItemAction`/`updateOrderItemAction`/`removeOrderItemAction`
 * içindeki `requireWritableWorkshop("order.edit")` darboğazıdır; buradaki karar
 * yalnızca onun UI'daki ikizidir — kullanıcıya çalışmayacak bir kutu göstermemek
 * için. Kilit (teslim/iptal) kararı düzenleyicinin KENDİ işidir: kilitli emirde
 * composer'ı gizler, kalemleri salt-okunur listeler. Bu yüzden burada kilit,
 * bölümü gizlemez — geçmiş kalemler sahada da okunabilir kalmalı.
 */

import { roleCan, type Permission } from "@/lib/roles"
import type { UserRole } from "@prisma/client"

export type TechnicianItemEditorMode =
  /** Düzenleyici açık — kalem eklenip düzenlenebilir (kilitliyse salt-okunur listeler). */
  | "editor"
  /** Kalem yazma izni yok — yalnız parça talebi açılabilir. */
  | "request-only"

/** Kalem düzenleyicinin dayandığı izin — tek yerde adlandırılır. */
export const ORDER_ITEM_PERMISSION: Permission = "order.edit"

export function canEditOrderItems(role: UserRole): boolean {
  return roleCan(role, ORDER_ITEM_PERMISSION)
}

export function technicianItemEditorMode(canEditOrder: boolean): TechnicianItemEditorMode {
  return canEditOrder ? "editor" : "request-only"
}

/** `request-only` modda gösterilen gerekçe — kullanıcıyı çalışan yola yönlendirir. */
export const REQUEST_ONLY_MESSAGE =
  "İş emrine doğrudan kalem ekleme yetkiniz yok. Ofis ekibi kalemleri işler; \"Dış Alımlar\" sekmesinden parça alımı kaydedebilirsiniz."
