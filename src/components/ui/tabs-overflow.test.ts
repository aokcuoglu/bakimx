import { expect, test, describe } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { tabsListVariants } from "./tabs"

/**
 * #277 — kaydırılabilir sekme şeridi ORTALANMAMALI.
 *
 * Ortalanmış bir flex kabı taştığında taşma iki yana dağılır: baştaki içerik
 * negatif ofsete düşer ve `scrollLeft` zaten 0 olduğu için oraya kaydırılamaz.
 * `/settings` şeridinde ilk sekme ("İş Yeri Profili") tam olarak böyle kalıcı
 * erişilemez hale gelmişti; aynı kombinasyon iş emri detayında da vardı ve
 * mobilde aynı sonucu veriyordu.
 *
 * Çözüm `justify-content: safe center`: sığdığı sürece ortalar, taştığı anda
 * `start`'a düşer. Bu testler hem paylaşılan varyantın hem de çağrı yerlerinin
 * düz `justify-center`'a geri dönmesini engeller.
 */

const UI_DIR = import.meta.dir
const SRC_DIR = join(UI_DIR, "..", "..")

/** Düz `justify-center` (varyantlı `justify-center-safe` HARİÇ). */
const BARE_JUSTIFY_CENTER = /(?:^|[\s"'`])justify-center(?![\w-])/

function tsxFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full))
    else if (entry.endsWith(".tsx")) out.push(full)
  }
  return out
}

describe("tabsListVariants", () => {
  test("şerit güvenli ortalama kullanır, düz ortalama kullanmaz", () => {
    for (const variant of ["default", "line"] as const) {
      const classes = tabsListVariants({ variant })
      expect(classes).toContain("justify-center-safe")
      expect(classes).not.toMatch(BARE_JUSTIFY_CENTER)
    }
  })
})

describe("TabsList çağrı yerleri", () => {
  test("hiçbir çağrı yeri şeridi düz justify-center ile ortalamıyor", () => {
    const offenders: string[] = []

    for (const file of tsxFiles(SRC_DIR)) {
      if (file === join(UI_DIR, "tabs.tsx")) continue
      const source = readFileSync(file, "utf8")
      if (!source.includes("<TabsList")) continue

      // `<TabsList ... >` açılış etiketinin className'i.
      for (const match of source.matchAll(/<TabsList\b[^>]*>/g)) {
        if (BARE_JUSTIFY_CENTER.test(match[0])) {
          offenders.push(file.slice(SRC_DIR.length + 1))
        }
      }
    }

    expect(offenders).toEqual([])
  })

  test("tarama gerçekten çağrı yeri buluyor (test kendini kandırmasın)", () => {
    const withTabsList = tsxFiles(SRC_DIR).filter((f) => readFileSync(f, "utf8").includes("<TabsList"))
    expect(withTabsList.length).toBeGreaterThan(0)
  })
})
