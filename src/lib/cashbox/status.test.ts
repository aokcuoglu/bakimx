import { expect, test } from "bun:test"
import { computePaymentStatus, computeRemainingAmount, orderDisplayPaymentStatus, orderPaidKurus } from "@/lib/cashbox/status"

// All amounts are integer kuruş.

test("exact payment reads as paid", () => {
  expect(computePaymentStatus(30, 30)).toBe("paid") // ₺0,30
  expect(computePaymentStatus(10000, 10000)).toBe("paid") // ₺100,00
})

test("underpayment is partial", () => {
  expect(computePaymentStatus(10000, 4000)).toBe("partial")
})

test("no payment is unpaid", () => {
  expect(computePaymentStatus(10000, 0)).toBe("unpaid")
})

test("over the total is overpaid", () => {
  expect(computePaymentStatus(10000, 10050)).toBe("overpaid")
})

test("remaining clamps and is exact", () => {
  expect(computeRemainingAmount(30, 30)).toBe(0)
  expect(computeRemainingAmount(10000, 4000)).toBe(6000)
  expect(computeRemainingAmount(10000, 15000)).toBe(0)
})

// #912 — ekrandaki "Tahsil Edilen" tek kaynaktan okunur.

test("defter yüklendiyse tahsil edilen defterden gelir", () => {
  expect(orderPaidKurus({ ledgerLoaded: true, completedTotalKurus: 12000, cachedPaidKurus: 12000 })).toBe(12000)
  // Önbellek bayatsa defter kazanır (eski `paidAmount || defter` önbelleği seçiyordu).
  expect(orderPaidKurus({ ledgerLoaded: true, completedTotalKurus: 8000, cachedPaidKurus: 12000 })).toBe(8000)
})

test("defter 0 iken önbellek > 0 olsa da 0 okunur (son tahsilat iptal edildi)", () => {
  expect(orderPaidKurus({ ledgerLoaded: true, completedTotalKurus: 0, cachedPaidKurus: 5000 })).toBe(0)
})

test("defter yüklenmediyse (Lite) önbellek okunur", () => {
  expect(orderPaidKurus({ ledgerLoaded: false, completedTotalKurus: 0, cachedPaidKurus: 7000 })).toBe(7000)
})

test("defter yüklenmediyse ve önbellek boşsa 0", () => {
  expect(orderPaidKurus({ ledgerLoaded: false, completedTotalKurus: 0, cachedPaidKurus: null })).toBe(0)
  expect(orderPaidKurus({ ledgerLoaded: false, completedTotalKurus: 0, cachedPaidKurus: undefined })).toBe(0)
})

// #912 — hap, tutarlarla aynı sayılardan okunur.

test("defter yüklendiyse ödeme durumu tutarlardan türetilir (bayat önbellek görülmez)", () => {
  expect(orderDisplayPaymentStatus({ ledgerLoaded: true, grandTotalKurus: 10000, paidKurus: 0, cachedStatus: "paid" })).toBe("unpaid")
  expect(orderDisplayPaymentStatus({ ledgerLoaded: true, grandTotalKurus: 10000, paidKurus: 4000, cachedStatus: "unpaid" })).toBe("partial")
  expect(orderDisplayPaymentStatus({ ledgerLoaded: true, grandTotalKurus: 10000, paidKurus: 10000, cachedStatus: "partial" })).toBe("paid")
  // recalcOrderPayment ile aynı kural.
  expect(orderDisplayPaymentStatus({ ledgerLoaded: true, grandTotalKurus: 10000, paidKurus: 10050, cachedStatus: "paid" }))
    .toBe(computePaymentStatus(10000, 10050))
})

test("defter yüklenmediyse önbellekteki durum okunur", () => {
  expect(orderDisplayPaymentStatus({ ledgerLoaded: false, grandTotalKurus: 10000, paidKurus: 0, cachedStatus: "partial" })).toBe("partial")
})
