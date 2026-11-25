import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8")

/**
 * e-santral ölçeği (docs/design-pattern-esantral.md, kullanıcı kararı 22-11):
 * telefonda iOS dokunma ölçüsü (44px), md+ masaüstü veri ekranlarında kompakt
 * (36px). Breakpoint yalnız md'dir; çağrı yerinde boyut ezilmez.
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

describe("kontrol ölçeği — e-santral (mobil 44px / masaüstü 36px)", () => {
  const globals = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8")

  test("--control-* değişkenleri telefonda 44px, md+ 36px", () => {
    const [mobile, desktop] = globals.split("@media (min-width: 768px)")
    expect(mobile).toContain("--control-h: 2.75rem;")
    expect(mobile).toContain("--control-fs: 17px;")
    expect(desktop).toContain("--control-h: 2.25rem;")
    expect(desktop).toContain("--control-fs: 15px;")
  })

  test("Button ölçüsünü değişkenden alır, md: sınıfı kullanmaz", () => {
    const block = buttonSizeBlock()
    expect(block).toContain('default: "h-(--control-h) gap-1.5 px-(--control-px)"')
    expect(block).toContain('sm: "h-(--control-h-sm) ')
    expect(block).toContain('lg: "h-(--control-h-lg) ')
    expect(block).toContain('xl: "h-(--control-h-xl) ')
    expect(block).toContain('xs: "h-(--control-h-xs) ')
    expect(block).toContain('compact: "h-(--control-h-xs) ')
    expect(block).toContain('icon: "size-(--control-h) rounded-full"')
    expect(block).toContain('"icon-sm": "size-(--control-h-sm) rounded-full"')
    expect(block).toContain('"icon-lg": "size-(--control-h-lg) rounded-full"')
    // Kırılımlı boyut sınıfı çağrı yerindeki h-auto / px- düzeltmesini ezer.
    expect(read("./button.tsx")).not.toMatch(/(?:sm|md|lg|xl):(?:h|size|min-h|px|pl|pr|text|rounded)-/)
    expect(block).not.toContain("has-data-[icon=")
  })

  test("Input, Select, Textarea ve InputGroup değişkenden ölçülür", () => {
    for (const file of ["./input.tsx", "./select.tsx", "./textarea.tsx", "./input-group.tsx"]) {
      expect(read(file)).not.toMatch(/(?:sm|md|lg|xl):(?:h|min-h|px|pl|pr|text|rounded)-/)
    }
    expect(read("./input.tsx")).toContain('"h-(--control-h) w-full min-w-0')
    const select = read("./select.tsx")
    expect(select).toContain('size?: "sm" | "default" | "compact"')
    expect(select).toContain("data-[size=default]:h-(--control-h)")
    expect(select).toContain("data-[size=sm]:h-(--control-h-sm)")
    expect(select).toContain("data-[size=compact]:h-(--control-h-xs)")
    expect(read("./input-group.tsx")).toContain("relative flex h-(--control-h) w-full min-w-0")
  })

  test("kalem düzenleyicisi kontrol ölçeğini yerelde ezmez", () => {
    const partsLaborGrid = read("../orders/parts-labor-grid.tsx")

    expect(partsLaborGrid).not.toContain("h-9")
  })
})

describe("dokunma ölçülü seçiciler — size=\"control\" (#846)", () => {
  test("Toggle ve Tabs primitive'leri ölçüyü değişkenden alır", () => {
    const toggle = read("./toggle.tsx")
    const tabs = read("./tabs.tsx")
    expect(toggle).toContain('control: "h-(--control-h) min-w-(--control-h)')
    expect(tabs).toContain("group-data-[size=control]/tabs-list:h-(--control-h)")
    for (const source of [toggle, tabs]) {
      expect(source).not.toMatch(/(?:sm|md|lg|xl):(?:h|size|min-h)-/)
    }
  })

  /**
   * Çağrı yeri mandalı: açılış etiketinde `h-7!` / `!h-7` yasak. Sınırı: sabite
   * çıkarılmış sınıfları (`const cls = "h-7!"`) görmez; yalnız etiketin kendi
   * `className`ini tarar.
   */
  test("ToggleGroup / Toggle / Tabs çağrı yerinde yükseklik `!` ile ezilmez", () => {
    const tag = /<(?:ToggleGroupItem|ToggleGroup|Toggle|TabsList|TabsTrigger)\b[^>]*>/gs
    const important = /(?:^|[\s"'`])(?:h|min-h)-[^\s"'`]+!|!(?:h|min-h)-[^\s"'`]+/
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) walk(path)
        else if (entry.name.endsWith(".tsx")) {
          const source = readFileSync(path, "utf8")
          for (const match of source.matchAll(tag)) {
            if (important.test(match[0])) offenders.push(`${path}: ${match[0].slice(0, 80)}`)
          }
        }
      }
    }
    walk(fileURLToPath(new URL("../../", import.meta.url)))
    expect(offenders).toEqual([])
  })
})

describe("köşe yarıçapı", () => {
  test("--radius e-santral yüzey değerinde (16px)", () => {
    const globals = readFileSync(
      new URL("../../app/globals.css", import.meta.url),
      "utf8"
    )
    expect(globals).toContain("--radius: 1rem;")
  })
})
