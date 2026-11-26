import { expect, test } from "bun:test"
import { calculateOrderTotals } from "@/lib/totals"
import { formatTRY } from "@/lib/format"
import { formatChainAmount, orderTotalsChain, totalsChainText } from "@/lib/orders/totals-chain"

const line = { type: "part", name: "Turbo radyatörü", quantity: 2, unitPrice: 20000, totalPrice: null }

test("BAK-55: ₺400 kalem, ₺200 indirim, %20 KDV → Ara Toplam / İndirim / KDV (%20)", () => {
  const totals = calculateOrderTotals([line], { discountAmount: 20000, taxRate: 2000 })
  expect(orderTotalsChain(totals, 2000)).toEqual([
    { key: "subtotal", label: "Ara Toplam", amount: 40000 },
    { key: "discount", label: "İndirim", amount: -20000 },
    { key: "tax", label: "KDV (%20)", amount: 4000 },
  ])
  // Zincir Genel Toplam'da kapanır.
  const sum = orderTotalsChain(totals, 2000).reduce((s, r) => s + r.amount, 0)
  expect(sum).toBe(totals.grandTotal)
})

test("indirim ve KDV yoksa zincir yok", () => {
  const totals = calculateOrderTotals([line], {})
  expect(orderTotalsChain(totals, null)).toEqual([])
  expect(totalsChainText(orderTotalsChain(totals, null))).toBeNull()
})

test("oran tanımlı ama hiçbir kalem KDV'ye tabi değilse KDV satırı basılmaz", () => {
  const totals = calculateOrderTotals([{ ...line, includeVat: false }], { taxRate: 2000 })
  expect(totals.taxAmount).toBe(0)
  expect(orderTotalsChain(totals, 2000)).toEqual([])
})

test("kısmi KDV'li belgede etiket gerçek oranı yazar (türetilmiş oranı değil)", () => {
  // Bir kalem tabi, biri değil: KDV / (ara toplam) = %10, belgenin oranı %20.
  const totals = calculateOrderTotals(
    [
      { ...line, quantity: 1, includeVat: true },
      { ...line, quantity: 1, includeVat: false },
    ],
    { taxRate: 2000 },
  )
  expect(totals.taxAmount).toBe(4000)
  expect(totals.subtotal).toBe(40000)
  const tax = orderTotalsChain(totals, 2000).find((r) => r.key === "tax")
  expect(tax?.label).toBe("KDV (%20)")
})

test("yalnız indirim varsa KDV satırı yok", () => {
  const totals = calculateOrderTotals([line], { discountAmount: 5000 })
  expect(orderTotalsChain(totals, 0).map((r) => r.key)).toEqual(["subtotal", "discount"])
})

test("indirim gerçek eksi işaretiyle yazılır; telefon satırı tek satırdır", () => {
  expect(formatChainAmount(-20000)).toBe(`−${formatTRY(20000)}`)
  const totals = calculateOrderTotals([line], { discountAmount: 20000, taxRate: 2000 })
  const text = totalsChainText(orderTotalsChain(totals, 2000))
  expect(text).toBe(
    `Ara Toplam ${formatTRY(40000)} · İndirim −${formatTRY(20000)} · KDV (%20) ${formatTRY(4000)}`,
  )
  expect(text).not.toContain("\n")
})
