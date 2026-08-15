"use server"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { requireAdminCapability } from "@/lib/admin"
import { prisma } from "@/lib/db"
import {
  bakimxOrderDecrementsStock,
  bakimxOrderTransitionError,
  canTransitionBakimxOrder,
  type BakimxOrderStatusValue,
} from "@/lib/catalog/bakimx-order"
import { bakimxOrderStatusSchema } from "@/lib/validations/bakimx-order"
import { getValidationError } from "@/lib/validations/shared"

/**
 * `/admin/catalog/orders` durum geçişleri (BAK-60).
 *
 * YETKİ: `requireAdminCapability("manageCatalog")` — `/admin/layout.tsx` guard'ı
 * action'lara MİRAS KALMAZ (bkz. src/lib/admin.ts), buradaki çağrı tek gerçek kapı.
 *
 * ÜÇ İNVARYANT BU DOSYADA DURUYOR:
 *
 *  2. **Stok yalnız `shipped` geçişinde düşer.** Talepte, `confirmed`'da ya da
 *     iş emrine kalem eklemede düşmez. Karar tek yerde:
 *     `bakimxOrderDecrementsStock`.
 *  3. **Düşüm bir kez olur.** Geçiş `updateMany({ where: { id, status: mevcut } })`
 *     ile yapılır: iki eşzamanlı "Gönderildi" isteğinden yalnız biri satırı
 *     yakalar, ikincisi `count = 0` alır ve transaction hiçbir stoğa dokunmadan
 *     geri sarılır. `where: { id }` ile yazsaydık ikinci istek de geçer ve stok
 *     iki kez düşerdi.
 *  5. **`cancelled` stoğa hiç dokunmaz** ve yalnız `shipped` öncesinde mümkündür
 *     (geçiş tablosu: src/lib/catalog/bakimx-order.ts).
 *
 * DENETİM: sevkiyattaki stok değişimi mevcut `BakimxCatalogAudit` tablosuna
 * yazılır (`action: "stock_change"`) ve yazma ile AYNI transaction içindedir —
 * stok düştüyse denetim satırı da vardır. Yeni bir denetim tablosu açılmadı:
 * admin toplu stok güncellemesi de zaten oraya yazıyor (bkz. ../actions.ts).
 */

type Result = { ok: true } | { ok: false; error: string }

/** Geçiş sırasında satırı başkası kaptı — transaction'ı geri sarmak için. */
class ConcurrentTransitionError extends Error {}

function asJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

function transitionTimestamps(to: BakimxOrderStatusValue, now: Date) {
  switch (to) {
    case "confirmed":
      return { confirmedAt: now }
    case "shipped":
      return { shippedAt: now }
    case "cancelled":
      return { cancelledAt: now }
    default:
      return {}
  }
}

export async function updateBakimxOrderStatusAction(raw: unknown): Promise<Result> {
  const ctx = await requireAdminCapability("manageCatalog")

  const parsed = bakimxOrderStatusSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: getValidationError(parsed) ?? "Geçersiz durum değişikliği." }
  }
  const orderId = parsed.data.orderId
  const nextStatus = parsed.data.status as BakimxOrderStatusValue

  const order = await prisma.bakimxOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      items: { select: { id: true, bakimxProductId: true, quantity: true } },
    },
  })
  if (!order) return { ok: false, error: "Sipariş bulunamadı." }

  const currentStatus = order.status as BakimxOrderStatusValue
  if (!canTransitionBakimxOrder(currentStatus, nextStatus)) {
    return { ok: false, error: bakimxOrderTransitionError(currentStatus, nextStatus) }
  }

  const now = new Date()
  try {
    await prisma.$transaction(async (tx) => {
      // Koşullu yazma: `status: currentStatus` şartı düşerse satırı başkası
      // değiştirmiştir ve bu geçiş HİÇ uygulanmaz (invaryant 3).
      const moved = await tx.bakimxOrder.updateMany({
        where: { id: orderId, status: currentStatus },
        data: { status: nextStatus, ...transitionTimestamps(nextStatus, now) },
      })
      if (moved.count === 0) throw new ConcurrentTransitionError()

      if (!bakimxOrderDecrementsStock(currentStatus, nextStatus)) return

      // Ürün kartı silinmiş olabilir (kalem FK taşımaz, snapshot yaşar) — olmayan
      // satır sevkiyatı engellemez, yalnız düşülecek stoğu yoktur.
      const existing = await tx.bakimxProduct.findMany({
        where: { id: { in: order.items.map((i) => i.bakimxProductId) } },
        select: { id: true },
      })
      const existingIds = new Set(existing.map((p) => p.id))

      const auditRows: Prisma.BakimxCatalogAuditCreateManyInput[] = []
      for (const item of order.items) {
        if (!existingIds.has(item.bakimxProductId)) continue
        // `decrement` + dönen satır: "önce" değerini ayrı bir okumadan türetmek
        // eşzamanlı iki sevkiyatta yanlış denetim yazardı.
        //
        // Stok NEGATİFE düşebilir ve bu bilinçlidir: talep anında rezervasyon
        // yok, iki atölye aynı 3 adedin 3'ünü birden isteyebilir. Sevkiyatı
        // bloklamak gerçekten çıkmış malı kaydedilemez yapardı; negatif değer
        // fazla sevkiyatı dürüstçe gösterir ve admin listesindeki uyarı zaten
        // sevkiyattan ÖNCE görünür.
        const updated = await tx.bakimxProduct.update({
          where: { id: item.bakimxProductId },
          data: { stockQty: { decrement: item.quantity }, updatedByUserId: ctx.user.id },
          select: { stockQty: true },
        })
        auditRows.push({
          actorUserId: ctx.user.id,
          entityType: "product",
          entityId: item.bakimxProductId,
          action: "stock_change",
          beforeJson: asJson({ stockQty: updated.stockQty + item.quantity }),
          afterJson: asJson({
            stockQty: updated.stockQty,
            quantity: item.quantity,
            reason: "bakimx_order_shipped",
            orderId,
            orderItemId: item.id,
          }),
        })
      }

      if (auditRows.length > 0) await tx.bakimxCatalogAudit.createMany({ data: auditRows })
    })
  } catch (err) {
    if (err instanceof ConcurrentTransitionError) {
      return { ok: false, error: "Sipariş bu sırada başka bir yerden güncellendi. Sayfayı yenileyin." }
    }
    console.error("[admin/catalog/orders]", err instanceof Error ? err.message : err)
    return { ok: false, error: "Sipariş durumu güncellenemedi." }
  }

  revalidatePath("/admin/catalog/orders")
  // Sevkiyat stoğu değiştirdi → katalog listesi de tazelenmeli.
  revalidatePath("/admin/catalog")
  return { ok: true }
}
