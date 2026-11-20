/**
 * Client-safe presentation of a local GetirBakım procurement row (contract v2.0).
 * `cancellationCode` values come from procurementCancellationCode in service.ts.
 */
export interface ProcurementBadgeState {
  status: string
  cancellationRequestedAt: string | null
  cancellationCode?: string | null
}

/** Shipping is not a column: the contract guarantees grossKurus = netKurus + vatKurus + shippingKurus. */
export function procurementShippingKurus(row: { bindingNetKurus: number | null; bindingVatKurus: number | null; bindingGrossKurus: number | null }): number | null {
  if (row.bindingNetKurus == null || row.bindingVatKurus == null || row.bindingGrossKurus == null) return null
  return Math.max(0, row.bindingGrossKurus - row.bindingNetKurus - row.bindingVatKurus)
}

export function procurementStatusLabel(state: ProcurementBadgeState): string {
  switch (state.status) {
    case "INITIATING": return "Talep iletiliyor"
    case "REQUESTED": return "Tedarik bekleniyor"
    case "CONFIRMED":
      if (state.cancellationCode === "REQUEST_REJECTED") return "İptal talebi reddedildi"
      return state.cancellationRequestedAt ? "İptal talebi iletildi" : "Tedarik onaylandı"
    case "SHIPPED": return "Sevkiyatta"
    case "COMPLETED": return "Tedarik tamamlandı"
    case "CANCELLED": return state.cancellationCode === "CANCELLED_BY_GETIRBAKIM" ? "GetirBakım iptal etti" : "Tedarik iptal edildi"
    case "FAILED": return "Tedarik başarısız"
    default: return "Tedarik kapandı"
  }
}

/**
 * Which cancel the contract's DELETE offers: REQUESTED is cancelled at once,
 * CONFIRMED only through a request operations decide (once; a rejection is final).
 */
export function procurementCancelAction(state: ProcurementBadgeState): "cancel" | "request" | null {
  if (state.status === "REQUESTED") return "cancel"
  if (state.status === "CONFIRMED" && !state.cancellationRequestedAt) return "request"
  return null
}

/** Open GetirBakım orders whose state can still change; their status is pulled on demand (no webhooks in v2.0). */
export function procurementCanRefresh(state: ProcurementBadgeState): boolean {
  return state.status === "REQUESTED" || state.status === "CONFIRMED" || state.status === "SHIPPED"
}
