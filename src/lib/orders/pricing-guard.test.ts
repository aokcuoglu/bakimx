import { test, expect } from "bun:test"
import { findUnpricedItems, unpricedItemsMessage } from "./pricing-guard"

const item = (id: string, name: string, unitPrice: number | null) => ({ id, name, unitPrice })

test("fiyatı hiç girilmemiş kalem (null) eksik sayılır", () => {
  expect(findUnpricedItems([item("1", "Hava filtresi", null)]).map((i) => i.id)).toEqual(["1"])
})

test("0 TL geçerli fiyattır, eksik sayılmaz", () => {
  expect(findUnpricedItems([item("1", "Garanti işçiliği", 0)])).toEqual([])
})

test("kalemi olmayan iş emrinde eksik yoktur", () => {
  expect(findUnpricedItems([])).toEqual([])
})

test("karışık listede yalnız null olanlar, sıra korunarak döner", () => {
  const items = [
    item("1", "Fren ampulü", 60000),
    item("2", "Hava filtresi", null),
    item("3", "Garanti işçiliği", 0),
    item("4", "Silecek süpürgesi", null),
  ]
  expect(findUnpricedItems(items).map((i) => i.name)).toEqual(["Hava filtresi", "Silecek süpürgesi"])
})

test("hata metni ilk iki ismi yazar, kalanı (+N) ile sayar", () => {
  const msg = unpricedItemsMessage([
    item("1", "Hava filtresi", null),
    item("2", "Silecek süpürgesi", null),
    item("3", "Yağ filtresi", null),
  ])
  expect(msg).toContain("Hava filtresi, Silecek süpürgesi (+1)")
  expect(msg).toContain("0 TL girilebilir")
})

test("hata metni iki veya daha az kalemde (+N) eklemez", () => {
  const msg = unpricedItemsMessage([item("1", "Hava filtresi", null), item("2", "Silecek süpürgesi", null)])
  expect(msg).toContain("Hava filtresi, Silecek süpürgesi.")
  expect(msg).not.toContain("(+")
})
