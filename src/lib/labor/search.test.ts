import { expect, test } from "bun:test"
import { foldTr, searchLaborItems } from "@/lib/labor/search"

const ITEMS = [
  { id: "1", code: "ISC-001", name: "Motor yağı ve filtre değişimi", category: "Bakım" },
  { id: "2", code: null, name: "Ön fren balatası değişimi", category: "Fren" },
  { id: "3", code: "ISC-009", name: "Rot balans ayarı", category: "Lastik / Balans" },
]

test("foldTr Türkçe diakritikleri sadeleştirir", () => {
  expect(foldTr("Değişim")).toBe("degisim")
  expect(foldTr("İŞÇİLİK")).toBe("iscilik")
})

test("aksansız yazım eşleşir", () => {
  const res = searchLaborItems(ITEMS, "degisim")
  expect(res.map((i) => i.id)).toEqual(["1", "2"])
})

test("kategori üzerinden eşleşir", () => {
  expect(searchLaborItems(ITEMS, "fren").map((i) => i.id)).toEqual(["2"])
})

test("koda göre eşleşir", () => {
  expect(searchLaborItems(ITEMS, "isc-009").map((i) => i.id)).toEqual(["3"])
})

test("boş sorgu tüm listeyi döndürür", () => {
  expect(searchLaborItems(ITEMS, "   ")).toHaveLength(3)
})

test("eşleşme yoksa boş dizi döner", () => {
  expect(searchLaborItems(ITEMS, "klima")).toEqual([])
})
