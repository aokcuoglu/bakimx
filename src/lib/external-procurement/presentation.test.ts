import { describe, expect, test } from "bun:test"
import { procurementCancelAction, procurementCanRefresh, procurementShippingKurus, procurementStatusLabel } from "./presentation"

const base = { cancellationRequestedAt: null, cancellationCode: null }

describe("procurement presentation (contract v2.0)", () => {
  test("labels statuses, cancel requests and who cancelled", () => {
    expect(procurementStatusLabel({ ...base, status: "REQUESTED" })).toBe("Tedarik bekleniyor")
    expect(procurementStatusLabel({ ...base, status: "CONFIRMED", cancellationRequestedAt: "2026-11-18T11:00:00.000Z", cancellationCode: "REQUEST_PENDING" })).toBe("İptal talebi iletildi")
    expect(procurementStatusLabel({ ...base, status: "CONFIRMED", cancellationRequestedAt: "2026-11-18T11:00:00.000Z", cancellationCode: "REQUEST_REJECTED" })).toBe("İptal talebi reddedildi")
    expect(procurementStatusLabel({ ...base, status: "CANCELLED", cancellationCode: "CANCELLED_BY_GETIRBAKIM" })).toBe("GetirBakım iptal etti")
    expect(procurementStatusLabel({ ...base, status: "CANCELLED", cancellationCode: "CANCELLED_BY_PARTNER" })).toBe("Tedarik iptal edildi")
    // Rows a 1.0 pilot may have left behind.
    expect(procurementStatusLabel({ ...base, status: "RESERVATION_EXPIRED" })).toBe("Tedarik kapandı")
  })

  test("offers the DELETE the contract allows for the status", () => {
    expect(procurementCancelAction({ ...base, status: "REQUESTED" })).toBe("cancel")
    expect(procurementCancelAction({ ...base, status: "CONFIRMED" })).toBe("request")
    expect(procurementCancelAction({ ...base, status: "CONFIRMED", cancellationRequestedAt: "2026-11-18T11:00:00.000Z" })).toBeNull()
    for (const status of ["INITIATING", "SHIPPED", "COMPLETED", "CANCELLED", "FAILED"]) expect(procurementCancelAction({ ...base, status })).toBeNull()
  })

  test("polls only orders that can still change", () => {
    expect(["REQUESTED", "CONFIRMED", "SHIPPED"].every((status) => procurementCanRefresh({ ...base, status }))).toBe(true)
    expect(["INITIATING", "COMPLETED", "CANCELLED", "FAILED"].some((status) => procurementCanRefresh({ ...base, status }))).toBe(false)
  })

  test("derives the shipping fee from the stored totals", () => {
    expect(procurementShippingKurus({ bindingNetKurus: 26000, bindingVatKurus: 5200, bindingGrossKurus: 36200 })).toBe(5000)
    expect(procurementShippingKurus({ bindingNetKurus: 1000, bindingVatKurus: 200, bindingGrossKurus: 1200 })).toBe(0)
    expect(procurementShippingKurus({ bindingNetKurus: null, bindingVatKurus: null, bindingGrossKurus: null })).toBeNull()
  })
})
