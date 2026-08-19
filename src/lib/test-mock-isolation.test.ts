import { expect, test } from "bun:test"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"

/**
 * BAK-129 — `mock.module` sızıntısı KAPSAM testi.
 *
 * `bun test` tüm dosyaları TEK süreçte koşar ve `mock.module()` süreç geneli,
 * kalıcı bir kayıt yapar: geri alınamaz. Bir test dosyası X modülünü sahtelerse,
 * X'i asıl test eden dosya kendisinden SONRA çalıştığında gerçek modül yerine o
 * sahteyi alır ve düşer. Dosya sırası platforma göre değiştiği için hata
 * lokalde yeşil, CI'da kırmızı olur — 19-08'de `src/lib/push/send.test.ts` tam
 * olarak böyle düştü (`push-dispatch.test.ts` `@/lib/push/send`'i sahteliyordu).
 *
 * Kural: kendi test dosyası olan bir modülü `mock.module` ile sahteleme.
 * Sahtelemek yerine test edilen kodu ayır (bkz. `resolveTechnicianPushDelivery`).
 */

const SRC_DIR = import.meta.dir.replace(/\/lib$/, "")
const ROOT_DIR = join(SRC_DIR, "..")

/** Sahteleme dışı bırakılan modüller. Anahtar: modül yolu, değer: gerekçe. */
const ALLOWLIST = new Map<string, string>()

const MOCK_MODULE = /mock\.module\(\s*["']([^"']+)["']/g

function testFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) testFiles(full, acc)
    else if (entry.endsWith(".test.ts") || entry.endsWith(".test.tsx")) acc.push(full)
  }
  return acc
}

/** Sahtelenen tanımlayıcıyı repo içi bir dosyaya çevirir; harici paket ise null. */
function resolveModule(specifier: string, fromFile: string): string | null {
  const base = specifier.startsWith("@/")
    ? join(SRC_DIR, specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(fromFile), specifier)
      : null
  if (!base) return null

  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

function ownTestFile(modulePath: string): string | null {
  const stem = modulePath.replace(/\.tsx?$/, "")
  for (const candidate of [`${stem}.test.ts`, `${stem}.test.tsx`]) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

test("hiçbir test, kendi test dosyası olan bir modülü mock.module ile sahtelemiyor", () => {
  const violations: string[] = []

  for (const file of [...testFiles(join(ROOT_DIR, "src")), ...testFiles(join(ROOT_DIR, "scripts"))]) {
    const source = readFileSync(file, "utf8")
    for (const match of source.matchAll(MOCK_MODULE)) {
      const specifier = match[1]
      const modulePath = resolveModule(specifier, file)
      if (!modulePath) continue
      if (ALLOWLIST.has(specifier)) continue

      const owner = ownTestFile(modulePath)
      if (owner && owner !== file) {
        violations.push(
          `${relative(ROOT_DIR, file)} → mock.module("${specifier}") ` +
            `ama o modülün kendi testi var: ${relative(ROOT_DIR, owner)}`,
        )
      }
    }
  }

  expect(violations).toEqual([])
})

test("allowlist'teki her muafiyetin gerekçesi yazılı", () => {
  for (const [specifier, reason] of ALLOWLIST) {
    expect(reason.length, `${specifier} gerekçesiz`).toBeGreaterThan(20)
  }
})
