import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8")

describe("mobile-first kontrol boyutları", () => {
  test("Button mobilde 44px, md+ form standardında 36px olur", () => {
    const source = read("./button.tsx")

    expect(source).toContain('default:\n          "h-11')
    expect(source).toContain("md:h-9")
    expect(source).toContain('icon: "size-11 md:size-9"')
    expect(source).toContain('compact: "h-11')
    expect(source).toContain('"icon-compact": "size-11 md:size-8"')
  })

  test("Input ve Select mobil/md+ matrisini korur", () => {
    const input = read("./input.tsx")
    const select = read("./select.tsx")

    expect(input).toContain("h-11")
    expect(input).toContain("md:h-9")
    expect(select).toContain('size?: "sm" | "default" | "compact"')
    expect(select).toContain("md:h-9")
    expect(select).toContain("md:data-[size=compact]:h-8")
  })
})
