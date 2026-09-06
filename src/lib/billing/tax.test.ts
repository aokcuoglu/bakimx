import { describe, expect, it } from "bun:test"
import { createBillingTaxSnapshot, SUBSCRIPTION_VAT_RATE_BPS } from "./tax"

describe("billing KDV snapshot", () => {
  it("%20 KDV dahil tutarı kuruş hassasiyetinde nete çevirir", () => {
    expect(createBillingTaxSnapshot(129_900)).toEqual({
      vatRateBps: SUBSCRIPTION_VAT_RATE_BPS,
      grossAmountMinor: 129_900,
      netAmountMinor: 108_250,
    })
    expect(createBillingTaxSnapshot(12_000).netAmountMinor).toBe(10_000)
  })

  it("kuruş yarımlarını deterministik yuvarlar", () => {
    expect(createBillingTaxSnapshot(1).netAmountMinor).toBe(1)
    expect(createBillingTaxSnapshot(2).netAmountMinor).toBe(2)
    expect(createBillingTaxSnapshot(Number.MAX_SAFE_INTEGER).netAmountMinor).toBe(7_505_999_378_950_826)
  })

  it("negatif, kesirli veya geçersiz oranları reddeder", () => {
    expect(() => createBillingTaxSnapshot(-1)).toThrow()
    expect(() => createBillingTaxSnapshot(10.5)).toThrow()
    expect(() => createBillingTaxSnapshot(100, 10_001)).toThrow()
  })
})
