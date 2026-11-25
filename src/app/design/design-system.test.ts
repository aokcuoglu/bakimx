import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dir, "../../..")

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8")
}

function walkSrc(dir = join(root, "src"), out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walkSrc(p, out)
    else if (/\.(tsx|ts|css)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(p)
  }
  return out
}

describe("design system radius contract", () => {
  // e-santral kalıbının bir kademe altı (karar 25-11, #878; kaynak kalıp
  // docs/design-pattern-esantral.md): düğme hap, girdi 10px (md+ 8px),
  // kart 12px, panel/KPI 14px, diyalog ve mobil sheet 18px.
  test("globals.css locks surface=12px panel=14px dialog=18px", () => {
    const css = read("src/app/globals.css")
    expect(css).toContain("--radius-sm: 0.375rem")
    expect(css).toContain("--radius-md: 0.5rem")
    expect(css).toContain("--radius-xl: 0.75rem")
    expect(css).toContain("--radius: 0.75rem;")
    expect(css).toContain("--radius-panel: 0.875rem;")
    expect(css).toContain("--radius-dialog: 1.125rem;")
  })

  test("shared controls and surfaces keep their measured radii", () => {
    // Düğme köşesi = telefon yüksekliğinin yarısı (hap); ikon düğmeleri daire.
    expect(read("src/components/ui/button.tsx")).toContain("rounded-[22px]")
    expect(read("src/components/ui/button.tsx")).toContain("rounded-full")
    expect(read("src/components/ui/input.tsx")).toContain("rounded-(--control-radius)")
    expect(read("src/components/ui/textarea.tsx")).toContain("rounded-(--control-radius)")
    expect(read("src/components/ui/select.tsx")).toContain(
      "gap-1.5 rounded-(--control-radius) border border-input"
    )
    expect(read("src/components/ui/alert.tsx")).toContain("rounded-(--control-radius)")
    expect(read("src/components/shared/bottom-sheet.tsx")).toContain(
      "rounded-t-(--radius-dialog)"
    )

    const card = read("src/components/ui/card.tsx")
    expect(card).toContain("rounded-lg")
    expect(card).not.toContain("ring-foreground/10")

    const dialog = read("src/components/ui/dialog.tsx")
    expect(dialog).toContain("rounded-[var(--radius-dialog)] bg-popover")
    expect(dialog).toContain("shadow-[var(--shadow-dialog)]")
  })

  test("DESIGN.md documents palette and /design gallery exists", () => {
    const designMd = read("DESIGN.md")
    expect(designMd).toContain("## Design Palette")
    expect(designMd).toContain("`/design`")

    const page = read("src/app/design/page.tsx")
    expect(page).toContain("Design System Analysis of BakımX")
    expect(page).toContain('id="palette"')
    expect(page).toContain('id="typography"')
    expect(page).toContain('id="components"')
    expect(page).toContain('id="cards"')
    expect(page).toContain('id="forms"')
    expect(page).toContain('id="spacing"')
    expect(page).toContain('id="elevation"')
    expect(page).toContain('id="responsive"')
    expect(page).toContain('index="01"')
    expect(page).toContain("ColorCard")
    expect(page).toContain("Brand & Accent")
  })

  test("src has no panel-scale rounded-2xl/3xl outside Badge pills", () => {
    const offenders: string[] = []
    for (const file of walkSrc()) {
      if (file.endsWith(`${join("components", "ui", "badge.tsx")}`)) continue
      const src = readFileSync(file, "utf8")
      if (
        src.includes("rounded-2xl") ||
        src.includes("rounded-3xl") ||
        src.includes("rounded-[20px]") ||
        src.includes("rounded-[2rem]")
      ) {
        offenders.push(file.replace(root + "/", ""))
      }
    }
    expect(offenders).toEqual([])
  })
})

describe("pazarlama kiti vitrini (#781)", () => {
  test("/design pazarlama kiti bölümünü ve tüm kit bileşenlerini gösterir", () => {
    expect(read("src/app/design/page.tsx")).toContain('id="marketing"')
    const showcase = read("src/app/design/marketing-kit.tsx")
    for (const name of ["PillButton", "TextLink", "RoundIconButton", "Wordmark", "FeatureTile", "PhotoCard", "NumberedSteps", "CheckList", "PriceBlock", "FaqAccordion", "FloatingField", "SuccessState"]) {
      expect(showcase).toContain(name)
    }
  })

  test("tasarım belgesi pazarlama ölçeğini ve token'ları belgeler", () => {
    const doc = read("docs/design-pattern-esantral.md")
    expect(doc).toContain("## 7. Pazarlama ölçeği")
    const css = read("src/app/globals.css")
    for (const token of css.match(/--mk-[a-z0-9-]+(?=:)/g) ?? []) expect(doc).toContain(token)
  })
})
