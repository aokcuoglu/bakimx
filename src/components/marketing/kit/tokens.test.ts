import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

// Pazarlama kiti token'ları (`--mk-*`) e-santral.com/bakimx'ten alındı ve yalnız
// açık temada tanımlıdır. CSS modülleri `var(--mk-*)` kullandığı için
// `theme-tokens.test.ts`'in Tailwind sınıf taraması bu çiftleri görmez; kontrast
// kapısı burada.
const CSS = readFileSync(join(import.meta.dir, "..", "..", "..", "app", "globals.css"), "utf8")

function block(selector: string): string {
  const start = CSS.indexOf(`\n${selector} {`)
  if (start < 0) return ""
  return CSS.slice(start, CSS.indexOf("\n}", start))
}

function tok(name: string): string {
  const match = block(":root").match(new RegExp(`--mk-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`))
  if (!match) throw new Error(`--mk-${name} :root içinde hex olarak tanımlı değil`)
  return match[1]
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2)
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

test("pazarlama metin/zemin çiftleri AA (4.5:1) geçer", () => {
  const pairs: [fg: string, bg: string][] = [
    ["ink", "surface"], ["gray", "surface"], ["gray", "soft"], ["gray-hero", "hero"],
    ["link", "surface"], ["link", "soft"], ["link", "hero"], ["surface", "blue"],
    ["surface", "blue-hover"], ["success", "success-bg"], ["warn", "warn-bg"],
    ["link", "info-bg"], ["error-text", "surface"], ["ink", "neutral"],
  ]
  for (const [fg, bg] of pairs) {
    const ratio = contrast(tok(fg), tok(bg))
    expect({ pair: `${fg}/${bg}`, ok: ratio >= 4.5 }).toEqual({ pair: `${fg}/${bg}`, ok: true })
  }
})

test("pazarlama token'ları yalnız açık temada tanımlı", () => {
  expect(block(":root")).toContain("--mk-ink")
  expect(block(".dark")).not.toContain("--mk-")
})
