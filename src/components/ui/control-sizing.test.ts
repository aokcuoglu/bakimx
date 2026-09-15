import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8")

/**
 * Input/Select upstream nova ölçeğini korur. #647 ile Button için onaylanan
 * Clutch ölçüleri DESIGN.md'de tanımlanır; yoğun ve ikon varyantları 32px kalır.
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
  test("Button Clutch ölçülerini ve yoğun kontrol hit alanlarını korur", () => {
    const block = buttonSizeBlock()
    expect(block).toContain('default: "h-[38px] gap-1.5 px-3.5"')
    expect(block).toContain('sm: "h-[38px] gap-1.5 px-3.5 ')
    expect(block).toContain('lg: "h-11 gap-1.5 px-4"')
    expect(block).toContain('xl: "h-12 gap-2 px-6"')
    expect(block).toContain('xs: "h-8 ')
    expect(block).toContain('compact: "h-8 ')
    for (const name of ["icon", "icon-xs", "icon-sm", "icon-lg", "icon-compact"]) {
      expect(block).toMatch(new RegExp(`"?${name}"?: "size-8`))
    }
    expect(block).not.toMatch(/md:(?:h|size|min-h)-/)
    expect(block).not.toContain("has-data-[icon=")
  })

  test("Input, Select ve InputGroup tek ölçekte", () => {
    const input = read("./input.tsx")
    const select = read("./select.tsx")
    const inputGroup = read("./input-group.tsx")

    expect(input).toContain('"h-8 w-full min-w-0')
    expect(input).not.toMatch(/md:(h|min-h)-/)

    expect(select).toContain('size?: "sm" | "default" | "compact"')
    expect(select).toContain("data-[size=default]:h-8")
    expect(select).toContain("data-[size=sm]:h-7")
    expect(select).toContain("data-[size=compact]:h-7")
    expect(select).not.toMatch(/md:(h|min-h)-/)

    expect(inputGroup).toContain("relative flex h-8 w-full min-w-0")
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
