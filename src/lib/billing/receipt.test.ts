import { expect, test } from "bun:test"
import { describeBillingOrder } from "@/lib/billing/addon-pricing"
import { generateReceiptHtml } from "@/lib/billing/receipt"

const base = {
  reference: "BX-ABC12",
  amountMinor: 59_900,
  confirmedAt: new Date("2026-11-27T09:00:00Z"),
  workshopName: "Test Servis",
  invoiceTitle: null,
  taxNumber: null,
  taxOffice: null,
  address: null,
}

test("ek özellik makbuzu kalem satırlarını ve KDV dahil toplamı gösterir (#829)", () => {
  const d = describeBillingOrder({
    type: "addon",
    planTier: "pro",
    billingCycle: "monthly",
    addonLines: [
      { key: "vinLookup", name: "Şaseden parça", quantity: 1, unitAmountMinor: 39_900, amountMinor: 39_900 },
      { key: "ocrIntake", name: "Ruhsat OCR", quantity: 1, unitAmountMinor: 20_000, amountMinor: 20_000 },
    ],
  })
  const html = generateReceiptHtml({ ...base, lines: d.lines, cycleLabel: d.cycleLabel })
  expect(html).toContain("Şaseden parça (Aylık)")
  expect(html).toContain("Ruhsat OCR (Aylık)")
  expect(html).not.toContain("paketi (")
  expect(html).toContain("Toplam (KDV dahil)")
})

test("paket makbuzu tek satır ve toplam tutarı gösterir", () => {
  const d = describeBillingOrder({ type: "new_purchase", planTier: "pro", billingCycle: "yearly" })
  const html = generateReceiptHtml({ ...base, lines: d.lines, cycleLabel: d.cycleLabel })
  expect(html).toContain("(Yıllık)")
  expect(html).toContain("Toplam (KDV dahil)")
})

test("kalemli paket makbuzu paket ve ek özellik tutarlarını ayrı gösterir (#1049)", () => {
  const d = describeBillingOrder({
    type: "renewal",
    planTier: "pro",
    billingCycle: "monthly",
    amountMinor: 139_900,
    addonLines: [{ key: "vinLookup", name: "VIN ile araç tanıma", quantity: 1, unitAmountMinor: 39_900, amountMinor: 39_900 }],
  })
  const html = generateReceiptHtml({ ...base, amountMinor: 139_900, lines: d.lines, cycleLabel: d.cycleLabel })
  expect(html).toContain("Servis Paketi (Aylık)")
  expect(html).toContain("VIN ile araç tanıma (Aylık)")
  // formatTRY kuruş alır; makbuz tutarı 100'e bölmemeli (eskiden ₺13,99 yazıyordu).
  expect(html).toMatch(/1\.000,00/)
  expect(html).toMatch(/399,00/)
  expect(html).toMatch(/1\.399,00/)
})
