/**
 * Dış işçiliğin alış fiyatı (#749).
 *
 * Dış işçilik (`type=external_labor`), atölyenin dışarıya PARA ÖDEYEREK
 * yaptırdığı iştir (rot balans, kaportacı…). Dış alımdaki parça gibi iki fiyatı
 * vardır ve ikisi aynı kolonlarda tutulur:
 *   • `purchasePriceKurus` — dışarıya ödenen (KDV hariç, kuruş): MALİYET,
 *   • `unitPrice`          — müşteriye satış fiyatı.
 *
 * Kural dış alımla aynı (bkz. addPurchaseItemAction): satış fiyatı verilmezse
 * alıştan ÖN-DOLDURULUR, sonra ofis üstüne kârını koyar. Ön-doldurma yüzünden
 * kârsız kalan kalemi `purchase-margin.ts` zaten adlandırır ve uyarır.
 *
 * Bu modül saf: sunucu action'ı ve istemci formları aynı kararı buradan alır.
 */

export type ExternalLaborPrices = {
  unitPrice: number | null
  purchasePriceKurus: number | null
}

/**
 * Satış fiyatı hâlâ alışı mı izliyor? Ya hiç girilmemiş ya da alışa eşit
 * (kimse üstüne kâr koymamış). Bu durumda alış değişince satış da onu izler;
 * elle revize edilmiş bir satış fiyatına ASLA dokunulmaz.
 */
export function salePriceFollowsCost(current: ExternalLaborPrices): boolean {
  return current.unitPrice == null || current.unitPrice === current.purchasePriceKurus
}

/** Yeni dış işçilik kaleminin fiyatları: satış verilmezse alıştan dolar. */
export function externalLaborCreatePrices(input: {
  unitPrice?: number | null
  purchasePriceKurus?: number | null
}): ExternalLaborPrices {
  const purchasePriceKurus = input.purchasePriceKurus ?? null
  return {
    purchasePriceKurus,
    unitPrice: input.unitPrice ?? purchasePriceKurus,
  }
}

/**
 * Mevcut dış işçilik kaleminin fiyat patch'i. Yalnız değişecek alanları döner.
 *
 * Alış değişip satış patch'te YOKSA, satış ancak hâlâ alışı izliyorsa
 * (`salePriceFollowsCost`) yeni alışa çekilir — teknisyen alışı düzeltince ofisin
 * koyduğu kâr silinmesin, ama hiç fiyatlanmamış kalem de fiyatsız kalmasın.
 */
export function externalLaborUpdatePrices(
  current: ExternalLaborPrices,
  patch: { unitPrice?: number; purchasePriceKurus?: number },
): { unitPrice?: number; purchasePriceKurus?: number } {
  const out: { unitPrice?: number; purchasePriceKurus?: number } = {}
  if (patch.purchasePriceKurus !== undefined) {
    out.purchasePriceKurus = patch.purchasePriceKurus
    if (patch.unitPrice === undefined && salePriceFollowsCost(current)) {
      out.unitPrice = patch.purchasePriceKurus
    }
  }
  if (patch.unitPrice !== undefined) out.unitPrice = patch.unitPrice
  return out
}

/**
 * Teknisyenin gördüğü "dışarıya ödenen" tutar. #749 öncesi kayıtlarda alış
 * kolonu boştur ve teknisyenin girdiği tutar satış fiyatına yazılmıştı — o
 * kayıtlarda geriye dönük olarak satış fiyatı gösterilir (backfill yapılmadı).
 */
export function externalLaborPaidKurus(item: ExternalLaborPrices): number | null {
  return item.purchasePriceKurus ?? item.unitPrice
}
