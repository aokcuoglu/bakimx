/**
 * GetirBakım partner order contract v2.0 examples (issue #751), copied from the
 * contract text so the tests pin the exact wire shape. Test-only data.
 */
export const OFFER_ID = "offer_0000a569053e4b84a484d510f04fab3b"

export const contractQuote = {
  contractVersion: "2.0",
  lines: [{
    selectedOfferId: OFFER_ID, quantity: 2, unitNetKurus: 13000, vatRateBps: 2000,
    lineNetKurus: 26000, lineVatKurus: 5200, lineGrossKurus: 31200,
  }],
  totals: { netKurus: 26000, vatKurus: 5200, shippingKurus: 5000, grossKurus: 36200 },
  currency: "TRY",
  expiresAt: "2026-11-18T10:15:00.000Z",
  confirmationToken: "opaque-confirmation-token",
} as const

export const contractShippingAddress = {
  recipientName: "Usta Oto Servis",
  phone: "0532 000 00 00",
  email: "servis@example.com",
  province: "İstanbul",
  district: "Kadıköy",
  addressLine: "Test Mahallesi 1. Sokak No 2",
  postalCode: "34710",
}

export const contractOrder = {
  contractVersion: "2.0",
  id: "6f1c1a52-5d3e-4f43-9d0e-1f6c2b7a9e10", number: 1042, idempotencyKey: "0f8fad5b-d9cb-469f-a165-70867728950e",
  status: "REQUESTED",
  paymentStatus: "ON_ACCOUNT",
  currency: "TRY",
  totals: { netKurus: 26000, vatKurus: 5200, shippingKurus: 5000, grossKurus: 36200 },
  lines: [{
    selectedOfferId: OFFER_ID, partNo: "LUK 510 0207 10", name: "Debriyaj bilyası", quantity: 2,
    unitNetKurus: 13000, vatRateBps: 2000, lineNetKurus: 26000, lineVatKurus: 5200, lineGrossKurus: 31200,
  }],
  shippingAddress: { recipientName: "Usta Oto Servis", phone: "+905320000000", email: null, province: "İstanbul", district: "Kadıköy", addressLine: "Test Mahallesi 1. Sokak No 2", postalCode: null },
  note: "",
  shipment: null,
  cancelledBy: null, cancelledAt: null,
  cancellationRequest: null,
  createdAt: "2026-11-18T10:01:00.000Z",
}
