import { test, expect } from "bun:test"
import { phoneSearchTerm } from "./phone-search"
import { normalizePhone } from "@/lib/format"

const STORED = normalizePhone("0544 515 74 08") // DB'de saklanan kanonik değer

test("saklanan telefon 10 haneli, ayraçsız kanonik değerdir", () => {
  expect(STORED).toBe("5445157408")
})

test("ekranda gösterilen biçim saklanan değeri bulur", () => {
  expect(STORED.includes(phoneSearchTerm("0544 515 74 08"))).toBe(true)
})

test("bitişik yazım saklanan değeri bulur", () => {
  expect(STORED.includes(phoneSearchTerm("5445157408"))).toBe(true)
})

test("baştaki 0 ile kısmi yazım saklanan değeri bulur", () => {
  expect(phoneSearchTerm("0544")).toBe("544")
  expect(STORED.includes(phoneSearchTerm("0544"))).toBe(true)
})

test("boşluklu kısmi yazım saklanan değeri bulur", () => {
  expect(phoneSearchTerm("544 515")).toBe("544515")
  expect(STORED.includes(phoneSearchTerm("544 515"))).toBe(true)
})

test("ülke kodlu yazımlar saklanan değeri bulur", () => {
  expect(phoneSearchTerm("+90 544 515 74 08")).toBe("5445157408")
  expect(phoneSearchTerm("905445157408")).toBe("5445157408")
  expect(phoneSearchTerm("00905445157408")).toBe("5445157408")
})

test("ayraçlı yazımlar rakamlara indirgenir", () => {
  expect(phoneSearchTerm("(0544) 515-74-08")).toBe("5445157408")
})

test("rakam içermeyen sorgu boş döner (contains: '' kuralı üretilmemeli)", () => {
  expect(phoneSearchTerm("")).toBe("")
  expect(phoneSearchTerm("Ahmet Yılmaz")).toBe("")
  expect(phoneSearchTerm("   ")).toBe("")
  expect(phoneSearchTerm("0")).toBe("")
})

test("kısa '90' girişi ülke kodu sayılmaz", () => {
  expect(phoneSearchTerm("90")).toBe("90")
})
