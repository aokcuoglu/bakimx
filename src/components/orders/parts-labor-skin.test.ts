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
    const band = css.match(/@container \(min-width: 52rem\) and \(max-width: 61\.99rem\) \{([\s\S]*?)\n\}/)
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
})
