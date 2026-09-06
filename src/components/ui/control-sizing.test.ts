import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8")

/**
 * Kontrol ölçeği artık upstream shadcn `nova` ile aynı: tek ölçek, breakpoint
 * yok (BAK-150). Önceki matris mobilde 44px zorunlu kılıyordu; kaldırıldı çünkü
 * 32px WCAG 2.2 AA 2.5.8'i (min 24px) geçiyor, düşen yalnız AAA 2.5.5.
 *
 * Boyut varyantları yalnız iç boşluk ve tipografiyi değiştirir; görünür her
 * Button 32px yüksekliğindedir. Mobil alt navigasyon Button değil `Link`
 * olduğu için bu matrisin dışında.
 *
 * Ayrıntı: docs/ui-control-sizing.md
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
  test("Button boyut varyantları 32px yüksekliğinde", () => {
    const block = buttonSizeBlock()

    // Her varyant aynı dikey ritmi korur.
    expect(block).toContain('default:\n          "h-8 gap-1.5 px-2.5')
    expect(block).toContain('xs: "h-8 ')
    expect(block).toContain('sm: "h-8 ')
    expect(block).toContain('lg: "h-8 ')
    expect(block).toContain('xl: "h-8 ')
    expect(block).toContain('icon: "size-8"')
    expect(block).toContain('"icon-xs":\n          "size-8 ')
    expect(block).toContain('"icon-sm":\n          "size-8 ')
    expect(block).toContain('"icon-lg": "size-8"')

    // BakımX'e özgü yoğun varyantlar
    expect(block).toContain('compact: "h-8 ')
    expect(block).toContain('"icon-compact": "size-8"')
    expect(block).not.toMatch(/\b(?:h-(?:6|7|9|10|11|12)|size-(?:6|7|9|10|11|12)|md:(?:h|size|min-h)-)/)
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
