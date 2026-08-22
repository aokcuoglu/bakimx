import { expect, test } from "bun:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { ORDER_ITEM_UNITS, quantityToNumber, validateQuantityForUnit } from "./quantity"

test("litre allows quantities with at most three decimal places", () => {
  expect(validateQuantityForUnit(1.2, "litre")).toBeNull()
  expect(validateQuantityForUnit(1.234, "litre")).toBeNull()
  expect(validateQuantityForUnit(1.2345, "litre")).not.toBeNull()
})

test("piece and stock-linked quantities remain integers", () => {
  expect(validateQuantityForUnit(2, "adet")).toBeNull()
  expect(validateQuantityForUnit(1.2, "adet")).not.toBeNull()
  expect(validateQuantityForUnit(1.2, "litre", true)).not.toBeNull()
})

test("automotive weight and length units allow decimals while packages remain integers", () => {
  expect(ORDER_ITEM_UNITS).toContain("kilogram")
  expect(ORDER_ITEM_UNITS).toContain("takim")
  expect(validateQuantityForUnit(0.25, "kilogram")).toBeNull()
  expect(validateQuantityForUnit(1.5, "metre")).toBeNull()
  expect(validateQuantityForUnit(1.5, "takim")).not.toBeNull()
  expect(validateQuantityForUnit(1.5, "kilogram", true)).not.toBeNull()
})

test("Prisma Decimal-like quantities normalize at DTO boundaries", () => {
  expect(quantityToNumber({ toNumber: () => 1.2 })).toBe(1.2)
})

/**
 * RSC Prisma Decimal'ı (ServiceOrderItem.quantity) istemci bileşenine
 * geçiremez. `items: true` veya `...order` ile ham satırı yaymak BAK-211
 * sonrası araç detayını kırdı: "Only plain objects can be passed… Decimal".
 *
 * Kural: bir sayfa tam kalem satırını yüklüyorsa (`items: true`) ve iş
 * emrini/kalemi yayıyorsa, ya `quantityToNumber` ile DTO'ya çevirmeli ya
 * da kalemleri istemciye hiç geçirmemeli.
 */
function appPages(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...appPages(full))
    else if (entry === "page.tsx") out.push(full)
  }
  return out
}

test("RSC pages do not spread Prisma order items with Decimal quantity", () => {
  const appDir = join(import.meta.dir, "../../app")
  const offenders: string[] = []

  for (const file of appPages(appDir)) {
    const text = readFileSync(file, "utf8")
    const loadsFullItems = /items:\s*true/.test(text)
    const spreadsOrder = /\.\.\.\w+\.order/.test(text)
    const spreadsItem = /\.\.\.\s*item\b/.test(text)
    if (!loadsFullItems && !spreadsOrder && !spreadsItem) continue
    if (text.includes("quantityToNumber")) continue
    if (spreadsOrder || spreadsItem || (loadsFullItems && /items:\s*\w+\.items\b/.test(text))) {
      offenders.push(file.slice(appDir.length + 1))
    }
  }

  expect(offenders).toEqual([])
})
