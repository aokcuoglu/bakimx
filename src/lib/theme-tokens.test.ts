import { expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

/**
 * Tailwind, tanımlı OLMAYAN bir renk token'ı için sessizce HİÇ kural üretmez.
 * Yani `text-destructive-foreground` gibi bir sınıf, token yoksa görünürde
 * doğru dururken hiçbir şey yapmaz — TypeScript de lint de yakalamaz. Gerçek
 * bir hata bu şekilde çıktı: dolu kırmızı zemin üzerindeki sil ikonu, foreground
 * token'ı olmadığı için kırmızı kalıp kayboluyordu (PR #241).
 *
 * Bu tarama, kaynakta kullanılan her `<utility>-<x>-foreground` sınıfı için
 * `globals.css`'teki `@theme` bloğunda `--color-<x>-foreground` tanımı arar.
 */

const ROOT = join(import.meta.dir, "..")
const SRC = join(ROOT, "..", "src")

/** `@theme` içinde tanımlı renk anahtarları (`--color-*`). */
function definedColorTokens(): Set<string> {
  const css = readFileSync(join(SRC, "app", "globals.css"), "utf8")
  const tokens = new Set<string>()
  for (const m of css.matchAll(/--color-([a-z0-9-]+)\s*:/g)) tokens.add(m[1])
  return tokens
}

/** Bir tema bloğundaki (`:root` / `.dark`) ham renk değişkenleri. */
function themeBlock(which: "root" | "dark"): Record<string, string> {
  const css = readFileSync(join(SRC, "app", "globals.css"), "utf8")
  const re = which === "root" ? /:root\s*\{([\s\S]*?)\n\}/ : /\.dark\s*\{([\s\S]*?)\n\}/
  const body = css.match(re)?.[1] ?? ""
  const vars: Record<string, string> = {}
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(oklch\([^)]*\)|#[0-9a-fA-F]{3,8})\s*;/g)) {
    vars[m[1]] = m[2]
  }
  return vars
}

/** oklch() / hex → sRGB [0-1]. */
function toRgb(value: string): [number, number, number] {
  if (value.startsWith("#")) {
    const h = value.slice(1)
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number]
  }
  const [L, C, H = 0] = value.match(/[-\d.]+/g)!.map(Number)
  const hr = (H * Math.PI) / 180
  const a = C * Math.cos(hr)
  const b = C * Math.sin(hr)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const enc = (v: number) => {
    const c = Math.max(0, Math.min(1, v))
    return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
  }
  return [
    enc(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    enc(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    enc(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

function contrast(bg: string, fg: string): number {
  const lum = (c: string) => {
    const f = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
    const [r, g, b] = toRgb(c)
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const a = lum(bg)
  const b = lum(fg)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** Kaynakta geçen `-foreground` renk sınıfları → kullanılan token adı. */
const CLASS_RE =
  /\b(?:text|bg|border|ring|fill|stroke|from|via|to|decoration|outline|shadow|accent|caret|divide)-([a-z0-9-]*foreground)\b/g

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(tsx?|css)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

test("globals.css destructive-foreground token'ını tanımlar", () => {
  expect(definedColorTokens().has("destructive-foreground")).toBe(true)
})

/**
 * Her `<renk>` / `<renk>-foreground` çifti, üstünde küçük metin taşıyabildiği
 * için WCAG AA (4.5:1) eşiğini geçmeli. `success` açık temada 3.47:1 ile
 * kalıyordu — yeşil zeminli butonun yazısı zor okunuyordu.
 */
test("tema renk/foreground çiftleri WCAG AA (4.5:1) geçer", () => {
  const failures: string[] = []

  for (const which of ["root", "dark"] as const) {
    const vars = themeBlock(which)
    for (const [name, bg] of Object.entries(vars)) {
      if (name.endsWith("-foreground")) continue
      const fg = vars[`${name}-foreground`]
      if (!fg) continue
      const ratio = contrast(bg, fg)
      if (ratio < 4.5) {
        const tema = which === "root" ? "açık" : "koyu"
        failures.push(`${tema}/${name}: ${ratio.toFixed(2)}:1 (bg ${bg}, fg ${fg})`)
      }
    }
  }

  expect(failures).toEqual([])
})

test("kullanılan her -foreground sınıfının temada karşılığı var", () => {
  const defined = definedColorTokens()
  const offenders: string[] = []

  for (const file of walk(SRC)) {
    const rel = file.slice(SRC.length + 1)
    const source = readFileSync(file, "utf8")
    source.split("\n").forEach((line, i) => {
      // `--color-foo-foreground: var(--foo-foreground)` tanımının kendisi kullanım değil.
      if (line.trimStart().startsWith("--color-")) return
      for (const m of line.matchAll(CLASS_RE)) {
        const token = m[1]
        if (!defined.has(token)) offenders.push(`${rel}:${i + 1} → ${m[0]} (--color-${token} tanımsız)`)
      }
    })
  }

  expect(offenders).toEqual([])
})
