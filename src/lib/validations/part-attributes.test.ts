import { expect, test } from "bun:test"
import { partCreateSchema, partSchema } from "@/lib/validations/part"

const requiredFields = { name: "Yağ filtresi", sku: "YF-1" }

test("form marka ve kategorisini trim eder", () => {
  const parsed = partSchema.parse({ ...requiredFields, brand: "  Bosch ", category: "  Filtre  " })
  expect(parsed.brand).toBe("Bosch")
  expect(parsed.category).toBe("Filtre")
})

test("sunucu doğrudan gönderilen marka ve kategoriyi de trim eder", () => {
  const parsed = partCreateSchema.parse({ ...requiredFields, brand: "  Bosch ", category: "  Filtre  " })
  expect(parsed.brand).toBe("Bosch")
  expect(parsed.category).toBe("Filtre")
})

test("aşırı uzun kategori reddedilir", () => {
  expect(partCreateSchema.safeParse({ ...requiredFields, category: "x".repeat(121) }).success).toBe(false)
})
