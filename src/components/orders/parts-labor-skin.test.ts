import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import path from "node:path"

const read = (file: string) => readFileSync(path.join(import.meta.dir, file), "utf8")
const css = read("parts-labor.module.css")
const grid = read("parts-labor-grid.tsx")

describe("Parça & İşçilik kabuğu (#849)", () => {
  test("CSS'in kullandığı her data-pl kancası grid'de var", () => {
    const hooks = new Set([...css.matchAll(/data-pl="([a-z]+)"/g)].map((m) => m[1]))
    expect(hooks.size).toBeGreaterThan(0)
    for (const hook of hooks) expect(grid).toContain(`data-pl="${hook}"`)
  })

  test("table/cards display'i yalnız iki sınırlı kapsayıcı bandında yazılır", () => {
    const band = css.match(/@container \(min-width: 54rem\) and \(max-width: 61\.99rem\) \{([\s\S]*?)\n\}/)
    expect(band).not.toBeNull()
    const outside = css.replace(band![0], "")
    for (const hook of ["table", "cards"]) {
      const rule = outside.match(new RegExp(`\\[data-pl="${hook}"\\]\\s*\\{([^}]*)\\}`))
      if (rule) expect(rule[1]).not.toContain("display")
      expect(band![1]).toContain(`[data-pl="${hook}"]`)
    }
  })

  test("sabit hex renk yok", () => {
    expect(css.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  test("grid yalnız surface.module.css'i alır (surface.tsx next/font yükler)", () => {
    expect(grid).toContain('"@/components/dashboard/surface.module.css"')
    expect(grid).not.toMatch(/dashboard\/surface"/)
  })

  test("kabuğu yalnız PartsLaborCard sarar", () => {
    expect(read("order-management-panel.tsx")).toContain("pl.skin")
    expect(read("../technician/technician-parts-labor-section.tsx")).not.toContain("parts-labor.module.css")
    expect(read("../quotes/quote-items-editor.tsx")).not.toContain("parts-labor.module.css")
  })

  test("hover yalnız kalem satırlarında (boş durum satırı vurgulanmaz)", () => {
    expect(css).toContain('tbody tr:has([data-pl="type"]):hover')
    expect(css).not.toMatch(/tbody tr:hover/)
  })

  test("alert kuralı genişlik verir (w-full + yan margin taşar)", () => {
    const rule = css.match(/\[data-slot="alert"\]\s*\{([^}]*)\}/)
    expect(rule?.[1]).toContain("width: auto")
  })

  test("liste yüksekliği: telefonda tavan kalkar, md+'da ekran oranlı tavan (#873)", () => {
    const base = css.match(/\.skin \[data-pl="cards"\] \{([^}]*)\}/)
    expect(base?.[1]).toContain("max-height: none")
    expect(base?.[1]).toContain("overflow-y: visible")
    expect(base?.[1]).not.toContain("display")
    const md = css.match(/@media \(min-width: 768px\) \{([\s\S]*?)\n\}/)
    expect(md?.[1]).toContain("min(70vh, 56rem)")
    expect(md?.[1]).toContain('[data-pl="table"] [data-slot="table-container"]')
    expect(md?.[1]).not.toContain("display")
  })

  test("#912: iş emrinde grid araç çubuğu ve ardındaki çizgi gizli; ekleme panel başlığında", () => {
    const rule = css.match(/\.skin \[data-pl="toolbar"\],\s*\.skin \[data-pl="toolbar"\] \+ \[data-slot="separator"\] \{([^}]*)\}/)
    expect(rule?.[1]).toContain("display: none")
    // Çizgi gerçekten araç çubuğunun DOM komşusu: arada yalnız portal'lı Dialog
    // (yerinde DOM üretmez) ve iş emrinde çizilmeyen teklif sekmeleri var.
    const toolbarAt = grid.indexOf('data-pl="toolbar"')
    const between = grid.slice(toolbarAt, grid.indexOf("{!locked && <Separator />}", toolbarAt))
    expect(between).toContain("{!locked && !onSaveRow && (")
    expect(between).not.toMatch(/<(div|section|p|span)\b/)
    // Panel başlığındaki menü aynı ekleme penceresini açar.
    const panel = read("order-management-panel.tsx")
    const card = panel.slice(panel.indexOf("export function PartsLaborCard"), panel.indexOf("export function OrderPaymentCard"))
    expect(card).toContain('aria-label="Kalem ekle"')
    expect(card).toContain('onAddingTypeChange("parca")')
    expect(card).toContain('onAddingTypeChange("iscilik")')
    expect(card).toContain("const canAdd = !isOrderLocked(status as OrderStatus)")
    // Kabuk araç çubuğunu hep gizlediği için pencere dışarıdan yönetilmek ZORUNDA.
    expect(card).toContain("addingType: PartsAddType | null\n")
    expect(card).toContain("onAddingTypeChange: (type: PartsAddType | null) => void\n")
  })

  test("kalem adı kuralı yalnız data-pl=name kancasını ve :disabled'ı hedefler (#873)", () => {
    expect(css).toMatch(/\.skin \[data-pl="name"\]:disabled \{/)
    const bare = css.replace(/\[data-pl="name"\]:disabled/g, "")
    expect(bare).not.toMatch(/:disabled/)
    expect(bare).not.toMatch(/input/)
    const rule = css.match(/\[data-pl="name"\]:disabled \{([^}]*)\}/)
    expect(rule?.[1]).toContain("opacity: 1")
    expect(rule?.[1]).not.toContain("height")
  })
})
