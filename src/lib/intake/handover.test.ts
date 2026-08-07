import { expect, test } from "bun:test"
import { resolveHandoverField } from "./handover"

test("alan gönderilmediyse mevcut değer korunur", () => {
  expect(resolveHandoverField(undefined, "Ahmet Yılmaz")).toBe("Ahmet Yılmaz")
  expect(resolveHandoverField(undefined, null)).toBeNull()
})

test("boş string gönderildiyse kayıt temizlenir", () => {
  expect(resolveHandoverField("", "Ahmet Yılmaz")).toBeNull()
})

test("yalnızca boşluktan oluşan giriş de temizler", () => {
  expect(resolveHandoverField("   ", "Ahmet Yılmaz")).toBeNull()
})

test("dolu değer kırpılarak yazılır", () => {
  expect(resolveHandoverField("  Ayşe Demir  ", null)).toBe("Ayşe Demir")
})

test("değer değişimi mevcut kaydın üzerine yazar", () => {
  expect(resolveHandoverField("Ayşe Demir", "Ahmet Yılmaz")).toBe("Ayşe Demir")
})
