import { z } from "zod/v4"
import { BAKIMX_ORDER_STATUSES } from "@/lib/catalog/bakimx-order"

/**
 * BakımX sipariş talebi doğrulama şemaları (BAK-60).
 *
 * FİYAT ALANI YOKTUR — bilerek. İstemci gövdeye `unitPriceKurus` koysa bile şema
 * onu tanımaz, sunucu fiyatı atölye kaydından çözer (bkz.
 * `bakimxOrderItemSnapshot`). Şemaya bir fiyat alanı EKLEMEYİN: eklendiği an
 * "fiyat istemciden gelmez" invaryantı yalnız bir yorum olur.
 */

/** Tek talepte istenebilecek en yüksek adet — parmak kayması sipariş olmasın. */
export const BAKIMX_ORDER_MAX_QUANTITY = 9_999
/** Tek talepteki en fazla farklı ürün. */
export const BAKIMX_ORDER_MAX_ITEMS = 50

export const bakimxOrderItemInputSchema = z.object({
  bakimxProductId: z.string().trim().min(1, "Ürün seçilmelidir"),
  quantity: z.coerce
    .number()
    .int("Adet tam sayı olmalıdır")
    .min(1, "Adet en az 1 olmalıdır")
    .max(BAKIMX_ORDER_MAX_QUANTITY, "Adet çok yüksek"),
})

export const bakimxOrderCreateSchema = z.object({
  items: z
    .array(bakimxOrderItemInputSchema)
    .min(1, "Siparişe en az bir ürün eklenmelidir")
    .max(BAKIMX_ORDER_MAX_ITEMS, `Bir siparişte en fazla ${BAKIMX_ORDER_MAX_ITEMS} ürün olabilir`)
    // Aynı ürünü iki satırda göndermek adet birleştirme mi yoksa hata mı belli
    // değil — belirsizliği sessizce yorumlamak yerine reddediyoruz.
    .refine(
      (items) => new Set(items.map((i) => i.bakimxProductId)).size === items.length,
      "Aynı ürün siparişe birden fazla kez eklenemez",
    ),
  note: z.string().trim().max(500, "Not en fazla 500 karakter olabilir").optional().default(""),
})

export type BakimxOrderCreateInput = z.infer<typeof bakimxOrderCreateSchema>

export const bakimxOrderStatusSchema = z.object({
  orderId: z.string().trim().min(1, "Sipariş seçilmelidir"),
  status: z.enum(BAKIMX_ORDER_STATUSES as [string, ...string[]]),
})
