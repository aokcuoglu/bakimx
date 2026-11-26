import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { ORDER_ITEM_UNIT_LABELS, ORDER_ITEM_UNITS, type OrderItemUnit } from "@/lib/orders/quantity"
import { matchesOrderItemUnit } from "./order-item-unit-combobox"

const SOURCE = readFileSync(join(import.meta.dir, "order-item-unit-combobox.tsx"), "utf8")

const matches = (query: string) =>
  ORDER_ITEM_UNITS.filter((unit: OrderItemUnit) => matchesOrderItemUnit(unit, query)).map(
    (unit) => ORDER_ITEM_UNIT_LABELS[unit]
  )

describe("birim seçici ortak ui/combobox'tır (#927)", () => {
  test("Popover + field Button tetikleyicisi geri gelmez", () => {
    expect(SOURCE).toContain('from "@/components/ui/combobox"')
    expect(SOURCE).not.toContain("PopoverTrigger")
    expect(SOURCE).not.toContain('role="listbox"')
    expect(SOURCE).not.toContain('variant="field"')
  })

  test("liste birim sabitlerinden ve Türkçe etiketlerden kurulur", () => {
    expect(SOURCE).toContain("items={ORDER_ITEM_UNITS}")
    expect(SOURCE).toContain('locale="tr"')
    expect(SOURCE).toContain("itemToStringLabel=")
    expect(SOURCE).toContain("filter={matchesOrderItemUnit}")
    expect(SOURCE).toContain("Birim bulunamadı")
  })

  test("devre dışı birim listede de seçimde de reddedilir; silinen metin seçimi boşaltmaz", () => {
    expect(SOURCE).toContain("disabled={isOptionDisabled?.(unit)}")
    expect(SOURCE).toContain("if (next == null || isOptionDisabled?.(next)) return")
  })

  test("kapalı alan yanındaki girdiyle aynı ölçüde, liste dar hücrede okunur genişlikte", () => {
    expect(SOURCE).toContain("size={size}")
    expect(SOURCE).toContain('<ComboboxContent minWidth="menu">')
    // Telefonda dokun → listeden seç: sanal klavye açılmaz.
    expect(SOURCE).toContain('inputMode="none"')
  })

  test("Enter çevreleyen formu göndermez (teklif formu)", () => {
    expect(SOURCE).toMatch(/if \(event\.key === "Enter"\) event\.preventDefault\(\)/)
  })
})

describe("birim filtresi Türkçe harfleri tabana indirger (#927)", () => {
  test("ASCII yazım Türkçe etiketi bulur", () => {
    expect(matches("sise")).toEqual(["Şişe"])
    expect(matches("SISE")).toEqual(["Şişe"])
    expect(matches("cift")).toEqual(["Çift"])
    expect(matches("tup")).toEqual(["Tüp"])
  })

  test("ı / I / İ ve i aynı harf sayılır", () => {
    expect(matches("takim")).toEqual(["Takım"])
    expect(matches("TAKIM")).toEqual(["Takım"])
    expect(matches("MİLİ")).toEqual(["Mililitre"])
    expect(matches("MILI")).toEqual(["Mililitre"])
  })

  test("Türkçe yazım ve parça eşleşmesi de çalışır, boş sorgu hepsini gösterir", () => {
    expect(matches("şişe")).toEqual(["Şişe"])
    expect(matches("litre")).toEqual(["Litre", "Mililitre"])
    expect(matches("  ")).toHaveLength(ORDER_ITEM_UNITS.length)
    expect(matches("xyz")).toEqual([])
  })
})
