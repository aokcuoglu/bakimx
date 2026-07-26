import { test, expect } from "bun:test"
import { freeTextCommit, type AttrOption } from "@/components/parts/part-attribute-commit"

const OPTS: AttrOption[] = [
  { id: 1, label: "Bosch" },
  { id: 2, label: "Mann Filter" },
]

test("boş/whitespace query → gösterme", () => {
  expect(freeTextCommit("", OPTS)).toEqual({ show: false, value: "" })
  expect(freeTextCommit("   ", OPTS)).toEqual({ show: false, value: "" })
})

test("katalogda olmayan değer → ＋ekle göster, trim'li", () => {
  expect(freeTextCommit("  seta ", OPTS)).toEqual({ show: true, value: "seta" })
})

test("birebir eşleşen (case-insensitive) → gösterme", () => {
  expect(freeTextCommit("bosch", OPTS)).toEqual({ show: false, value: "bosch" })
})

test("kısmi eşleşme yine ＋ekle gösterir", () => {
  expect(freeTextCommit("Mann", OPTS)).toEqual({ show: true, value: "Mann" })
})

test("boş seçenek listesi (unlinked) → dolu query'de göster", () => {
  expect(freeTextCommit("seta", [])).toEqual({ show: true, value: "seta" })
})

test("tr-I tuzağı: büyük I içeren katalog markası birebir eşleşir", () => {
  expect(freeTextCommit("ina", [{ id: 1, label: "INA" }])).toEqual({ show: false, value: "ina" })
})

test("kayıtlı serbest değere eşit query → ＋ekle gösterme (no-op önlenir)", () => {
  expect(freeTextCommit("seta", [], "seta")).toEqual({ show: false, value: "seta" })
  expect(freeTextCommit(" seta ", [], "seta")).toEqual({ show: false, value: "seta" })
})

test("kayıtlı değerden farklı yeni query → ＋ekle göster", () => {
  expect(freeTextCommit("setax", [], "seta")).toEqual({ show: true, value: "setax" })
})
