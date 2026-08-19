/**
 * Parça/işçilik talebi → iş emri kalemi EŞLEMESİ.
 *
 * Ofis talebi kaleme çevirdiğinde (convertPartsRequestToOrderItemAction) hangi
 * alanın kaleme nasıl geçeceği burada, saf ve test edilebilir tek bir yerde
 * durur. Kural tipe göre ayrışır:
 *
 *   • `part`           → kalem tipi `part`, katalog alanları (sku/marka/TecDoc)
 *                        taşınır, kaynak katalog eşleşmesine göre catalog|manual.
 *   • `external_labor` → kalem tipi `external_labor`, katalog alanları YOK;
 *                        firma `supplierName`, tahmini tutar ise SATIŞ fiyatı
 *                        değil `purchasePriceKurus` (alış maliyeti) olur.
 *
 * `partId` HİÇBİR tipte yazılmaz → STOK DÜŞÜMÜ OLMAZ. Bu bugünkü davranıştır
 * (talep kendi stok kartımıza bağlanmıyor) ve dış işçilikte zaten anlamsızdır.
 *
 * Kaynak `manual` (purchase DEĞİL): `source: "purchase"` seçilseydi bu satırlar
 * Dış Alımlar ekranına ve KPI'larına da düşerdi (src/app/(app)/purchases/page.tsx)
 * — o ekran parça alımı için tasarlandı, dış işçilik oraya karışmasın.
 */

/** Kaleme çevrilirken okunan en dar talep şekli — Prisma satırı da uyar. */
export type ConvertibleRequest = {
  type: string
  partName: string
  partSku: string | null
  brand: string | null
  quantity: number
  note: string | null
  tecdocArticleId: number | null
  supplierName: string | null
  estimatedPriceKurus: number | null
}

/** Talebin kaleme çevrileceği alanlar (workshopId/serviceOrderId çağıran tarafta). */
export type ConvertedItemFields = {
  type: "part" | "external_labor"
  name: string
  sku: string | null
  brand: string | null
  quantity: number
  note: string | null
  tecdocArticleId: number | null
  source: "catalog" | "manual"
  supplierName: string | null
  purchasePriceKurus: number | null
}

export function isExternalLaborRequest(request: { type: string }): boolean {
  return request.type === "external_labor"
}

export function partsRequestToItemFields(request: ConvertibleRequest): ConvertedItemFields {
  if (isExternalLaborRequest(request)) {
    return {
      type: "external_labor",
      name: request.partName,
      sku: null,
      brand: null,
      quantity: request.quantity,
      note: request.note,
      tecdocArticleId: null,
      source: "manual",
      supplierName: request.supplierName,
      // Tahmini tutar MALİYET tarafına yazılır; satış fiyatını (unitPrice) ofis
      // ayrıca girer — fiyat kapısı (pricing-guard) onu zaten zorunlu kılıyor.
      purchasePriceKurus: request.estimatedPriceKurus,
    }
  }

  return {
    type: "part",
    name: request.partName,
    sku: request.partSku,
    brand: request.brand,
    quantity: request.quantity,
    note: request.note,
    tecdocArticleId: request.tecdocArticleId,
    source: request.tecdocArticleId ? "catalog" : "manual",
    supplierName: null,
    purchasePriceKurus: null,
  }
}

/** Kullanıcıya dönük tip etiketi — talep listesi, toast ve zaman çizelgesi ortak kullanır. */
export function partsRequestTypeLabel(type: string): string {
  return type === "external_labor" ? "Dış işçilik" : "Parça"
}
