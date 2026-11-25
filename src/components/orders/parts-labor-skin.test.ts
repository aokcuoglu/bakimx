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

  test("table/cards kuralları display yazmaz (hidden/@min geçişi bozulur)", () => {
    for (const hook of ["table", "cards"]) {
      const rule = css.match(new RegExp(`\\[data-pl="${hook}"\\]\\s*\\{([^}]*)\\}`))
      if (rule) expect(rule[1]).not.toContain("display")
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
})
