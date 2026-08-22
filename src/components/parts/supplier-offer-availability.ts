import type { GetirbakimOffer } from "@/lib/parts/getirbakim/types"

export function transactionalAvailability(offer: GetirbakimOffer, quantity: number): {
  canRequestQuote: boolean
  label: string
  selectionLabel: string
} {
  const requiredQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1
  if (offer.stockQty == null) {
    return {
      canRequestQuote: false,
      label: offer.availability === "SUPPLYABLE"
        ? "Tedarikçi temin edebilir · Sipariş uygunluğu bilinmiyor"
        : "Sipariş uygunluğu bilinmiyor",
      selectionLabel: "Uygunluk bilinmiyor",
    }
  }
  if (offer.stockQty < requiredQuantity) {
    return {
      canRequestQuote: false,
      label: offer.availability === "SUPPLYABLE" ? "Stok yok · Tedarikçi temin edebilir" : "Stok yok",
      selectionLabel: "Stok yetersiz",
    }
  }
  return {
    canRequestQuote: true,
    label: `Siparişe uygun · ${offer.stockQty} adet`,
    selectionLabel: "Teklifi seç",
  }
}
