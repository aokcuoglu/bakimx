import { describe, expect, test } from "bun:test"
import type { GetirbakimOffer } from "@/lib/parts/getirbakim/types"
import { transactionalAvailability } from "./supplier-offer-availability"

function offer(overrides: Partial<GetirbakimOffer> = {}): GetirbakimOffer {
  return {
    selectedOfferId: "offer-1",
    supplierDisplayName: "Tedarikçi",
    informationalPriceKurus: 10000,
    currency: "TRY",
    vatRateBps: 2000,
    availability: "IN_STOCK",
    stockQty: 3,
    lastSyncedAt: "2026-08-22T12:00:00.000Z",
    ...overrides,
  }
}

describe("transactional offer availability", () => {
  test("pozitif ve yeterli rezervasyon miktarını siparişe uygun gösterir", () => {
    expect(transactionalAvailability(offer({ stockQty: 3 }), 2)).toEqual({
      canRequestQuote: true,
      label: "Siparişe uygun · 3 adet",
      selectionLabel: "Teklifi seç",
    })
  })

  test("reliable zero stock'u supplier capability'den ayırır ve fail closed tutar", () => {
    expect(transactionalAvailability(offer({ availability: "SUPPLYABLE", stockQty: 0 }), 1)).toEqual({
      canRequestQuote: false,
      label: "Stok yok · Tedarikçi temin edebilir",
      selectionLabel: "Stok yetersiz",
    })
  })

  test("istenen adetten az stokta bağlayıcı teklif seçimini kapatır", () => {
    expect(transactionalAvailability(offer({ stockQty: 1 }), 2).canRequestQuote).toBe(false)
  })

  test("unknown/unavailable rezervasyon miktarında tahmin yürütmez", () => {
    expect(transactionalAvailability(offer({ availability: "UNKNOWN", stockQty: null, lastSyncedAt: null }), 1)).toEqual({
      canRequestQuote: false,
      label: "Sipariş uygunluğu bilinmiyor",
      selectionLabel: "Uygunluk bilinmiyor",
    })
  })

  test("non-binding supplier capability tek başına seçilebilirlik sağlamaz", () => {
    const result = transactionalAvailability(offer({ availability: "SUPPLYABLE", stockQty: null }), 1)
    expect(result.canRequestQuote).toBe(false)
    expect(result.label).toContain("Tedarikçi temin edebilir")
    expect(result.label).toContain("Sipariş uygunluğu bilinmiyor")
  })
})
