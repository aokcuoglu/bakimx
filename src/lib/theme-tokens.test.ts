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
