import { describe, expect, test } from "bun:test"
import {
  externalLaborCreatePrices,
  externalLaborPaidKurus,
  externalLaborUpdatePrices,
  salePriceFollowsCost,
} from "./external-labor-cost"
import { purchaseMarginState } from "./purchase-margin"

describe("externalLaborCreatePrices", () => {
  test("satış verilmezse alıştan ön-dolar", () => {
    expect(externalLaborCreatePrices({ purchasePriceKurus: 50_000 })).toEqual({
      purchasePriceKurus: 50_000,
      unitPrice: 50_000,
    })
  })

  test("satış verilirse ona dokunulmaz", () => {
    expect(externalLaborCreatePrices({ purchasePriceKurus: 50_000, unitPrice: 65_000 })).toEqual({
      purchasePriceKurus: 50_000,
      unitPrice: 65_000,
    })
  })

  test("alışsız kalem eski davranışı korur", () => {
    expect(externalLaborCreatePrices({ unitPrice: 30_000 })).toEqual({ purchasePriceKurus: null, unitPrice: 30_000 })
    expect(externalLaborCreatePrices({})).toEqual({ purchasePriceKurus: null, unitPrice: null })
  })

  test("ön-doldurulan kalem kârsız uyarısına düşer, kâr eklenince düşmez", () => {
    expect(purchaseMarginState(externalLaborCreatePrices({ purchasePriceKurus: 50_000 }))).toBe("at-cost")
    expect(
      purchaseMarginState(externalLaborCreatePrices({ purchasePriceKurus: 50_000, unitPrice: 60_000 })),
    ).toBe("marked-up")
  })
})

describe("externalLaborUpdatePrices", () => {
  test("revize edilmemiş satış yeni alışı izler", () => {
    expect(
      externalLaborUpdatePrices({ purchasePriceKurus: 50_000, unitPrice: 50_000 }, { purchasePriceKurus: 55_000 }),
    ).toEqual({ purchasePriceKurus: 55_000, unitPrice: 55_000 })
  })

  test("fiyatsız kalem alış girilince fiyatlanır", () => {
    expect(
      externalLaborUpdatePrices({ purchasePriceKurus: null, unitPrice: null }, { purchasePriceKurus: 40_000 }),
    ).toEqual({ purchasePriceKurus: 40_000, unitPrice: 40_000 })
  })

  test("ofisin koyduğu kâr alış düzeltilince silinmez", () => {
    expect(
      externalLaborUpdatePrices({ purchasePriceKurus: 50_000, unitPrice: 70_000 }, { purchasePriceKurus: 52_000 }),
    ).toEqual({ purchasePriceKurus: 52_000 })
  })

  test("eski kayıt (alış yok, satış var) satışını korur", () => {
    expect(
      externalLaborUpdatePrices({ purchasePriceKurus: null, unitPrice: 30_000 }, { purchasePriceKurus: 25_000 }),
    ).toEqual({ purchasePriceKurus: 25_000 })
  })

  test("aynı patch'te satış da varsa o kazanır", () => {
    expect(
      externalLaborUpdatePrices(
        { purchasePriceKurus: 50_000, unitPrice: 50_000 },
        { purchasePriceKurus: 55_000, unitPrice: 66_000 },
      ),
    ).toEqual({ purchasePriceKurus: 55_000, unitPrice: 66_000 })
  })

  test("alış patch'te yoksa yalnız satış yazılır", () => {
    expect(externalLaborUpdatePrices({ purchasePriceKurus: 50_000, unitPrice: 50_000 }, { unitPrice: 60_000 })).toEqual({
      unitPrice: 60_000,
    })
    expect(externalLaborUpdatePrices({ purchasePriceKurus: 50_000, unitPrice: 50_000 }, {})).toEqual({})
  })
})

describe("salePriceFollowsCost / externalLaborPaidKurus", () => {
  test("izleme koşulu", () => {
    expect(salePriceFollowsCost({ purchasePriceKurus: null, unitPrice: null })).toBe(true)
    expect(salePriceFollowsCost({ purchasePriceKurus: 100, unitPrice: 100 })).toBe(true)
    expect(salePriceFollowsCost({ purchasePriceKurus: 100, unitPrice: 120 })).toBe(false)
    expect(salePriceFollowsCost({ purchasePriceKurus: null, unitPrice: 120 })).toBe(false)
  })

  test("ödenen tutar alıştır; eski kayıtta satışa düşer", () => {
    expect(externalLaborPaidKurus({ purchasePriceKurus: 50_000, unitPrice: 70_000 })).toBe(50_000)
    expect(externalLaborPaidKurus({ purchasePriceKurus: null, unitPrice: 30_000 })).toBe(30_000)
    expect(externalLaborPaidKurus({ purchasePriceKurus: null, unitPrice: null })).toBeNull()
  })
})
