import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

// next/font/google bun test'te yüklenemez (SWC dönüşümü ister); bu yüzden
// kaynaktan bakılır. Korunan iki şey (#815):
// 1. `var(--font-kpi)` fallback'siz yazılırsa değişkenin olmadığı yerde tüm
//    font-family bildirimi geçersizleşir ve sessizce miras fonta düşer.
// 2. Display fontu yalnız Genel Bakış'ın büyük kartlarında; Araç Kabulleri'nin
//    kompakt filtre kartları sistem fontunda kalır.
const css = readFileSync(join(process.cwd(), "src/components/dashboard/surface.module.css"), "utf8")
const surface = readFileSync(join(process.cwd(), "src/components/dashboard/surface.tsx"), "utf8")

function rulesUsing(property: string): { selector: string; body: string }[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map((m) => ({ selector: m[1].replace(/\/\*[\s\S]*?\*\//g, "").trim(), body: m[2] }))
    .filter((r) => new RegExp(`(^|;|\\s)${property}\\s*:`).test(r.body))
}

describe("KPI rakamı display fontu (#815)", () => {
  test("font değişkeni sistem fontu fallback'iyle okunur", () => {
    const kpiRules = rulesUsing("font-family").filter((r) => r.body.includes("--font-kpi"))
    expect(kpiRules.length).toBe(1)
    expect(kpiRules[0].body).toContain("var(--font-kpi, var(--font-sans))")
  })

  test("yalnız kompakt olmayan kartın rakamına uygulanır", () => {
    const [rule] = rulesUsing("font-family").filter((r) => r.body.includes("--font-kpi"))
    expect(rule.selector).toBe('.stat:not([data-size="compact"]) > .statValue')
    expect(surface).toContain('size !== "compact" && kpiNumeralFont.variable')
  })
})
