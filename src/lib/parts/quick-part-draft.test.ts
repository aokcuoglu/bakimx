import { expect, test } from "bun:test"
import {
  QUICK_PART_NAME_REQUIRED,
  QUICK_PART_SKU_REQUIRED,
  validateQuickPartDraft,
} from "./quick-part-draft"

test("ad boşsa gönderilmez", () => {
  expect(validateQuickPartDraft({ name: "  ", sku: "BLK-1", createStockItem: true })).toBe(
    QUICK_PART_NAME_REQUIRED
  )
})

test("stok kartı açılacaksa kod zorunludur", () => {
  expect(validateQuickPartDraft({ name: "Fren balatası", sku: "", createStockItem: true })).toBe(
    QUICK_PART_SKU_REQUIRED
  )
})

test("stok kartı açılacaksa yalnız boşluktan ibaret kod da kabul edilmez", () => {
  expect(validateQuickPartDraft({ name: "Fren balatası", sku: "   ", createStockItem: true })).toBe(
    QUICK_PART_SKU_REQUIRED
  )
})

test("anahtar kapalıyken kod isteğe bağlıdır (bugünkü tek seferlik kalem davranışı)", () => {
  expect(validateQuickPartDraft({ name: "Fren balatası", sku: "", createStockItem: false })).toBeNull()
})

test("ad + kod doluyken taslak geçerlidir", () => {
  expect(
    validateQuickPartDraft({ name: "Fren balatası", sku: "BLK-1234", createStockItem: true })
  ).toBeNull()
})

test("ad boşsa kod hatasından ÖNCE ad hatası döner", () => {
  // Her iki alan da eksikken kullanıcı önce ada yönlendirilir; kod hatası
  // ad yazıldıktan sonra görünür.
  expect(validateQuickPartDraft({ name: "", sku: "", createStockItem: true })).toBe(
    QUICK_PART_NAME_REQUIRED
  )
})
