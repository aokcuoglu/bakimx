import { describe, expect, test } from "bun:test"
import {
  formatAddonMinor,
  addonFeaturesFor,
  computeAddonProrationMinor,
  describeBillingOrder,
  evaluateAddonOrderEligibility,
  isAddonPeriodOpen,
  isPerBranchAddon,
  isReleasableExpiredAddonOrder,
  getAddonPriceMinor,
  isAddonOrderKey,
  parseAddonOrderLines,
  priceAddonOrder,
} from "@/lib/billing/addon-pricing"

const now = new Date("2026-01-01T00:00:00Z")
const day = 86_400_000
const inDays = (n: number) => new Date(now.getTime() + n * day)

test("fiyatlar kuruş; yıllık = 10 × aylık", () => {
  expect(getAddonPriceMinor("vinLookup", "monthly")).toBe(39_900)
  expect(getAddonPriceMinor("ocrIntake", "monthly")).toBe(24_900)
  expect(getAddonPriceMinor("multiBranch", "yearly")).toBe(749_000)
  for (const k of ["vinLookup", "ocrIntake", "multiBranch"] as const) {
    expect(getAddonPriceMinor(k, "yearly")).toBe(getAddonPriceMinor(k, "monthly") * 10)
  }
})

test("fiyatsız kalem fırlatır", () => {
  expect(() => getAddonPriceMinor("aiAssistant" as never, "monthly")).toThrow()
})

test("orantı: tam dönem tam fiyat, 1 gün 1 günlük, geçmiş fırlatır", () => {
  const full = 39_900
  expect(computeAddonProrationMinor({ fullAmountMinor: full, cycle: "monthly", currentPeriodEnd: inDays(30), now })).toBe(full)
  expect(computeAddonProrationMinor({ fullAmountMinor: full, cycle: "monthly", currentPeriodEnd: inDays(90), now })).toBe(full)
  expect(computeAddonProrationMinor({ fullAmountMinor: full, cycle: "monthly", currentPeriodEnd: inDays(1), now })).toBe(Math.ceil(full / 30))
  expect(computeAddonProrationMinor({ fullAmountMinor: full, cycle: "monthly", currentPeriodEnd: new Date(now.getTime() + 1000), now })).toBe(Math.ceil(full / 30))
  expect(() => computeAddonProrationMinor({ fullAmountMinor: full, cycle: "monthly", currentPeriodEnd: now, now })).toThrow()
})

test("sipariş: adet çarpar, toplamlar tutar", () => {
  const r = priceAddonOrder({
    items: [{ key: "vinLookup", quantity: 1 }, { key: "multiBranch", quantity: 2 }],
    cycle: "monthly",
    currentPeriodEnd: inDays(30),
    now,
  })
  expect(r.lines[1].amountMinor).toBe(74_900 * 2)
  expect(r.amountMinor).toBe(39_900 + 74_900 * 2)
  expect(r.fullCycleAmountMinor).toBe(r.amountMinor)
  expect(r.lines[0].name).toBeTruthy()
})

test("parseAddonOrderLines bozuk girdiyi düşürür", () => {
  const ok = { key: "ocrIntake", name: "x", quantity: 1, unitAmountMinor: 5, amountMinor: 5 }
  expect(parseAddonOrderLines([ok, { ...ok, key: "zzz" }, null, { ...ok, quantity: 0 }, "a"])).toEqual([ok])
  expect(parseAddonOrderLines(undefined)).toEqual([])
  expect(isAddonOrderKey("vinLookup")).toBe(true)
  expect(isAddonOrderKey("eInvoice")).toBe(false)
})

test("addonFeaturesFor tekilleştirir", () => {
  expect(addonFeaturesFor(["vinLookup", "vinLookup", "ocrIntake"]).sort()).toEqual(["ocrIntake", "partsCatalog", "vinLookup"])
})

test("describeBillingOrder paket ve ek özellik", () => {
  const pkg = describeBillingOrder({ type: "new_purchase", planTier: "pro", billingCycle: "yearly" })
  expect(pkg.title).toBe("Servis Paketi")
  expect(pkg.cycleLabel).toBe("Yıllık")
  expect(pkg.lines[0].amountMinor).toBeNull()
  const line = { key: "vinLookup", name: "Şaseden parça", quantity: 1, unitAmountMinor: 100, amountMinor: 100 }
  const one = describeBillingOrder({ type: "addon", planTier: "pro", billingCycle: "monthly", addonLines: [line] })
  expect(one.title).toBe("Ek özellik: Şaseden parça")
  expect(one.lines).toEqual([{ label: "Şaseden parça", amountMinor: 100 }])
  const two = describeBillingOrder({ type: "addon", planTier: "pro", billingCycle: "monthly", addonLines: [line, { ...line, key: "ocrIntake" }] })
  expect(two.title).toBe("Ek özellik")
  expect(two.lines).toHaveLength(2)
})

test("formatAddonMinor: tam liralar kuruşsuz, kuruş yalnız sıfır değilse", () => {
  const norm = (v: string) => v.replace(/\s/g, " ")
  expect(norm(formatAddonMinor(39_900))).toBe("₺399")
  expect(norm(formatAddonMinor(399_000))).toBe("₺3.990")
  expect(norm(formatAddonMinor(21_280))).toBe("₺212,80")
  expect(norm(formatAddonMinor(21_250))).toBe("₺212,50")
})

describe("ek özellik uygunluğu (#829)", () => {
  const ok = {
    isAccountWorkshop: true,
    subscriptionStatus: "active",
    currentPeriodEnd: inDays(10),
    now,
    items: [{ key: "vinLookup" as const, owned: false }],
    pending: null,
  }
  const reason = (over: Partial<typeof ok>) => {
    const r = evaluateAddonOrderEligibility({ ...ok, ...over })
    return r.ok ? "ok" : r.reason
  }

  test("her kapı kendi nedenini döndürür", () => {
    expect(reason({})).toBe("ok")
    expect(reason({ isAccountWorkshop: false })).toBe("not_account")
    expect(reason({ subscriptionStatus: "trial" })).toBe("no_open_period")
    expect(reason({ currentPeriodEnd: null })).toBe("no_open_period")
    expect(reason({ currentPeriodEnd: inDays(-1) })).toBe("no_open_period")
    expect(reason({ currentPeriodEnd: now })).toBe("no_open_period")
    expect(reason({ items: [{ key: "vinLookup", owned: true }] })).toBe("already_owned")
    expect(reason({ pending: "own" })).toBe("pending_own")
    expect(reason({ pending: "tax" })).toBe("pending_tax")
  })

  test("hata iletileri Türkçe ve ürün adını taşır", () => {
    const r = evaluateAddonOrderEligibility({ ...ok, items: [{ key: "vinLookup", owned: true }] })
    expect(!r.ok && r.error).toBe("Şaseden parça zaten hesabınızda açık.")
  })

  test("birim katalogdan: yalnız şube kalemi çok adetli olabilir", () => {
    expect(isPerBranchAddon("multiBranch")).toBe(true)
    expect(isPerBranchAddon("vinLookup")).toBe(false)
    expect(isPerBranchAddon("ocrIntake")).toBe(false)
  })

  test("dönemi bitmiş + canlı işlemsiz bekleyen ek özellik siparişi serbest bırakılır", () => {
    const o = { type: "addon", status: "pending_payment" }
    expect(isReleasableExpiredAddonOrder(o, inDays(-1), [], now)).toBe(true)
    expect(isReleasableExpiredAddonOrder(o, null, [], now)).toBe(true)
    expect(isReleasableExpiredAddonOrder(o, inDays(-1), [{ status: "failed" }, { status: "expired" }], now)).toBe(true)
    // açık dönemde bekleyen sipariş eskisi gibi engeller
    expect(isReleasableExpiredAddonOrder(o, inDays(5), [], now)).toBe(false)
    // canlı / tamamlanmış kart işlemi varsa dokunulmaz
    for (const status of ["initiated", "callback_received", "completed"]) {
      expect(isReleasableExpiredAddonOrder(o, inDays(-1), [{ status }], now)).toBe(false)
    }
    // paket siparişi hiç serbest bırakılmaz
    expect(isReleasableExpiredAddonOrder({ type: "renewal", status: "pending_payment" }, inDays(-1), [], now)).toBe(false)
  })

  test("isAddonPeriodOpen: yalnız aktif ve bitmemiş dönem", () => {
    expect(isAddonPeriodOpen({ subscriptionStatus: "active", currentPeriodEnd: inDays(1) }, now)).toBe(true)
    expect(isAddonPeriodOpen({ subscriptionStatus: "active", currentPeriodEnd: inDays(-1) }, now)).toBe(false)
    expect(isAddonPeriodOpen({ subscriptionStatus: "trial", currentPeriodEnd: inDays(1) }, now)).toBe(false)
    expect(isAddonPeriodOpen(null, now)).toBe(false)
  })
})
