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
  test("globals.css locks control=6px surface=10px xl=12px", () => {
    const css = read("src/app/globals.css")
    expect(css).toContain("--radius-sm: 0.375rem")
    expect(css).toContain("--radius-md: 0.5rem")
    expect(css).toContain("--radius-xl: 0.75rem")
    expect(css).toContain("--radius: 0.625rem")
  })

  test("shared controls use sm; surfaces use lg", () => {
    expect(read("src/components/ui/button.tsx")).toContain("rounded-[6px]")
    expect(read("src/components/ui/input.tsx")).toContain("rounded-sm")
    expect(read("src/components/ui/textarea.tsx")).toContain("rounded-sm")
    expect(read("src/components/ui/select.tsx")).toContain(
      "gap-1.5 rounded-sm border border-input"
    )

    const card = read("src/components/ui/card.tsx")
    expect(card).toContain("rounded-xl")
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


