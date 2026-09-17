import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dir, "../../..")

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8")
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
    expect(card).toContain("rounded-lg")
    expect(card).not.toContain("rounded-xl")

    const dialog = read("src/components/ui/dialog.tsx")
    expect(dialog).toContain("rounded-lg bg-popover")
    expect(dialog).not.toContain("rounded-xl bg-popover")
  })

  test("DESIGN.md documents palette and /design gallery exists", () => {
    const designMd = read("DESIGN.md")
    expect(designMd).toContain("## Design Palette")
    expect(designMd).toContain("`/design`")

    const page = read("src/app/design/page.tsx")
    expect(page).toContain("BakımX Design System")
    expect(page).toContain('id="colors"')
    expect(page).toContain('id="typography"')
    expect(page).toContain('id="rounded"')
    expect(page).toContain('id="components"')
  })
})
