import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8")

/**
 * Attio ölçüleri: standart düğme ve girdi 28px, select 32px, kompakt 20px.
 */

/** `size: {` bloğunun gövdesini kaba ama yeterli bir şekilde çıkarır. */
function buttonSizeBlock() {
  const source = read("./button.tsx")
  const start = source.indexOf("      size: {")
  const end = source.indexOf("      },\n    },\n    defaultVariants:")
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  return source.slice(start, end)
}

describe("kontrol ölçeği — upstream shadcn nova", () => {
  test("Button Attio ölçülerini korur", () => {
    const block = buttonSizeBlock()
    expect(block).toContain('default: "h-7 gap-1 py-1 pr-2 pl-1.5"')
    expect(block).toContain('sm: "h-7 gap-1 py-1 pr-2 pl-1.5"')
    expect(block).toContain('lg: "h-7 gap-1.5 px-2"')
    expect(block).toContain('xl: "h-7 gap-1.5 px-2"')
    expect(block).toContain('xs: "h-5 ')
    expect(block).toContain('compact: "h-5 ')
    expect(block).toContain('icon: "size-7"')
    expect(block).toContain('"icon-xs": "size-5 ')
    expect(block).toContain('"icon-sm": "size-7"')
    expect(block).toContain('"icon-lg": "size-7"')
    expect(block).toContain('"icon-compact": "size-5 ')
    expect(block).not.toMatch(/md:(?:h|size|min-h)-/)
    expect(block).not.toContain("has-data-[icon=")
  })

  test("Input, Select ve InputGroup tek ölçekte", () => {
    const input = read("./input.tsx")
    const select = read("./select.tsx")
    const inputGroup = read("./input-group.tsx")

    expect(input).toContain('"h-7 w-full min-w-0')
    expect(input).not.toMatch(/md:(h|min-h)-/)

    expect(select).toContain('size?: "sm" | "default" | "compact"')
    expect(select).toContain("data-[size=default]:h-8")
    expect(select).toContain("data-[size=sm]:h-7")
    expect(select).toContain("data-[size=compact]:h-5")
    expect(select).not.toMatch(/md:(h|min-h)-/)

    expect(inputGroup).toContain("relative flex h-7 w-full min-w-0")
    expect(inputGroup).not.toMatch(/md:(h|min-h)-/)
  })

  test("kalem düzenleyicisi 32px kontrol ölçeğini yerelde ezmez", () => {
    const partsLaborGrid = read("../orders/parts-labor-grid.tsx")

    expect(partsLaborGrid).not.toContain("h-9")
  })
})

describe("köşe yarıçapı", () => {
  test("--radius upstream değerinde", () => {
    const globals = readFileSync(
      new URL("../../app/globals.css", import.meta.url),
      "utf8"
    )
    expect(globals).toContain("--radius: 0.625rem;")
  })
})
