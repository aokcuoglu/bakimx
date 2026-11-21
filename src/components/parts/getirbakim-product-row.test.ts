import { expect, test } from "bun:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { GetirbakimProductRow } from "./getirbakim-product-row"
import { parseGetirbakimProduct } from "@/lib/parts/getirbakim/types"
import { formatTRY } from "@/lib/format"

/**
 * #760: B2B iskonto GetirBakım panelinde partner bazında yönetilir. Satır
 * GetirBakım'ın verdiği iskontolu `b2bPriceKurus`'u ve `discountBps`'i olduğu gibi
 * basar; liste fiyatını göstermez, iskontoyu kendisi hesaplamaz.
 */
function row(over: Record<string, unknown>) {
  const product = parseGetirbakimProduct({
    id: "1", sourceProductId: "1", partNo: "GDB1330", name: "Fren Balatası", brandName: "TRW",
    categoryName: "Fren", oemNumbers: [], imageUrl: null, listPriceKurus: 20000,
    vatRateBps: 2000, currency: "TRY", stockQty: 4, availability: "IN_STOCK", lastSyncedAt: null,
    ...over,
  })
  if (!product) throw new Error("fixture")
  return renderToStaticMarkup(createElement(GetirbakimProductRow, { product }))
}

test("iskontolu alış fiyatını ve GetirBakım'ın oranını gösterir", () => {
  const html = row({ b2bPriceKurus: 18000, discountBps: 1000 })
  expect(html).toContain(`Alış: ${formatTRY(18000)}`)
  expect(html).toContain("%10 GetirBakım iskontosu uygulandı")
  expect(html).not.toContain(formatTRY(20000))
})

test("iskonto yokken not çıkmaz, fiyat aynen basılır", () => {
  const html = row({ b2bPriceKurus: 20000, discountBps: 0 })
  expect(html).toContain(`Alış: ${formatTRY(20000)}`)
  expect(html).not.toContain("iskontosu")
})
