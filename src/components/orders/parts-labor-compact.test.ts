import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const read = (rel: string) => readFileSync(join(import.meta.dir, rel), "utf8")
const grid = read("parts-labor-grid.tsx")
const panel = read("order-management-panel.tsx")
const detail = read("work-order-detail.tsx")
const matrix = read("../intake/photo-phase-matrix.tsx")

describe("kalem tablosu (#967)", () => {
  test("işlem kolonu üç ikonu (~100px + 16px dolgu) taşır", () => {
    const cols = grid.slice(grid.indexOf("<colgroup>"), grid.indexOf("</colgroup>"))
    const last = cols.slice(cols.lastIndexOf("<col "))
    expect(last).toContain('className="w-30"')
    expect(cols).not.toContain('<col className="w-24" />\n          </colgroup>')
  })

  test("salt okunur miktar adımlayıcı yerine metin", () => {
    const stepper = grid.slice(grid.indexOf("function QtyStepper"), grid.indexOf("function QuantityField"))
    expect(stepper).toContain("if (!editable) return <span")
    expect(stepper.indexOf("if (!editable)")).toBeLessThan(stepper.indexOf('data-slot="qty-stepper"'))
  })

  test("toplam satırı Ödeme kartıyla aynı kaynaktan okur ve yalnız tek kolonda görünür", () => {
    const footer = panel.slice(panel.indexOf("function ItemsTotalFooter"), panel.indexOf("export function OrderPaymentCard"))
    expect(footer).toContain("totals.grandTotal")
    expect(footer).toContain("orderTotalsChain(totals, taxRateBps)")
    expect(footer).toContain("@min-[780px]/detail:hidden")
    expect(footer).toContain('href="#odeme"')
    // Yeniden hesap yok: tutarlar items'tan toplanmaz.
    expect(footer).not.toContain("reduce(")
    expect(detail).toContain("totals={order.totals}")
    expect(panel).toContain("totals?.hasAnyPrice")
  })

  test("iki kolon eşiği sayfanın kapsayıcı eşiğiyle aynı", () => {
    expect(read("order-detail.module.css")).toContain("@container detail (min-width:780px)")
  })

  test("Kanıt: boş açılar kompakt çip, dolu kareler ızgarada", () => {
    expect(matrix).toContain("function EmptyChip")
    expect(matrix).not.toContain("function EmptyTile")
    expect(matrix).toContain("Eklenmemiş açılar")
    expect(matrix).toContain("filledList.length > 0")
  })
})

describe("kompakt kalem satırı (#968)", () => {
  test("yalnız compactRows verilen iş emri kabuğunda; teklif ve teknisyen kart kalır", () => {
    expect(panel).toContain("compactRows\n")
    expect(grid).toContain("compactRows = false")
    expect(grid).toContain("<CompactPartRow")
    expect(grid).toContain("<MobilePartRow")
    for (const file of ["../quotes/quote-items-editor.tsx", "../technician/technician-parts-labor-section.tsx"]) {
      expect(read(file)).not.toContain("compactRows")
    }
  })

  test("iki satır: ad (2 satır kırpma) + tutar; tür hapı + adet × fiyat; tek ⋯ menüsü", () => {
    const row = grid.slice(grid.indexOf("function CompactPartRow"), grid.indexOf("// ── Mobil satırı"))
    expect(row).toContain("line-clamp-2")
    expect(row).toContain("ed.grossLineTotal")
    expect(row).toContain("compactRowDetail(row)")
    expect(row).toContain("<TypeChip")
    expect(row).toContain("menuOnly")
    // Alanlar hep salt okunur; düzenleme mevcut diyaloğa gider.
    expect(row).not.toContain("<QtyStepper")
    expect(row).not.toContain("<PriceField")
  })

  test("menuOnly: satır içi ikon yok, tüm aksiyonlar menüde, tetikleyici 44px dokunma hedefi", () => {
    expect(grid).toContain("const inline = menuOnly ? []")
    expect(grid).toContain("const overflow = menuOnly ? actions")
    expect(grid).toContain('size={menuOnly ? "icon" : "icon-sm"}')
  })

  test("Kalemi düzenle diyaloğu ilk odak davranışı korunur (#964)", () => {
    expect(grid).toContain("onOpenAutoFocus={focusFirstEditableField}")
    expect(grid).toContain("onEdit: onSaveRow && !locked ? setEditingRow : undefined")
  })
})
