import { expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

import { ACTIVE_CHECKLIST_ITEM, isActiveChecklistItem } from "./checklist-visibility"

/**
 * Kontrol maddesi silme SOFT'tur: satır DB'de kalır, yalnızca `deletedAt`
 * işaretlenir — çünkü seed "bu şablon maddesi bu iş emrinde var mı" sorusunu
 * satırın varlığından cevaplar. Bu yüzden madde OKUYAN her sorgu
 * `ACTIVE_CHECKLIST_ITEM` ile filtrelemek zorunda; unutulursa kullanıcının
 * çıkardığı madde listede/ilerlemede geri görünür ve TypeScript bunu yakalamaz.
 *
 * Aşağıdaki tarama, `photo-visibility.test.ts` ile aynı mantıkta: filtresiz
 * kalan bir okuma yolunu testte patlatır. Yeni bir okuma yolu eklerken ya
 * filtreyi kullan ya da bilinçli istisnaysa gerekçesiyle listeye ekle.
 */

const SRC = join(import.meta.dir, "..", "..")

/** Filtresiz olması BİLİNÇLİ olan yollar — her biri gerekçeli. */
const INTENTIONALLY_UNFILTERED: Record<string, string> = {
  // Seed silinen maddeyi "var" saymalı, yoksa çıkarılan madde geri doğar.
  "lib/technician/checklist-seed.ts": "seed must see tombstones so removed template items never come back",
  // Kapı okuması seed kararı için `templateKey`lere muhtaç; eleme `deletedAt`
  // üzerinden gates'te yapılır. Sil/geri al aksiyonları da silinmiş satırı
  // bulabilmeli (idempotanlık).
  "app/(app)/technician/actions.ts": "gate read needs template keys of removed rows; delete/restore resolve tombstones",
  // Teknisyen paneli silinenleri "Geri al" bölümünde gösterir; ayrım bellekte.
  "app/(app)/technician/orders/[id]/page.tsx": "technician panel renders removed items in the restore section",
}

/** Kontrol maddesi okuduğuna işaret eden desenler. */
const READ_PATTERNS = [
  /prisma\.checklistItem\.(findMany|findFirst|findUnique|count)/,
  /tx\.checklistItem\.(findMany|findFirst|findUnique|count)/,
  /^\s*checklistItems:\s*(\{|true)/,
]

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

test("ACTIVE_CHECKLIST_ITEM silinmiş maddeleri gizler", () => {
  expect(ACTIVE_CHECKLIST_ITEM).toEqual({ deletedAt: null })
})

test("isActiveChecklistItem yalnız silinmemişlere true döner", () => {
  expect(isActiveChecklistItem({ deletedAt: null })).toBe(true)
  expect(isActiveChecklistItem({})).toBe(true)
  expect(isActiveChecklistItem({ deletedAt: new Date() })).toBe(false)
  expect(isActiveChecklistItem({ deletedAt: "2026-08-10T00:00:00.000Z" })).toBe(false)
})

test("kontrol maddesi okuyan her sorgu ACTIVE_CHECKLIST_ITEM ile filtreler", () => {
  const offenders: string[] = []

  for (const file of walk(SRC)) {
    const rel = file.slice(SRC.length + 1)
    if (rel in INTENTIONALLY_UNFILTERED) continue

    const source = readFileSync(file, "utf8")
    const lines = source.split("\n")

    lines.forEach((line, i) => {
      if (!READ_PATTERNS.some((p) => p.test(line))) return
      // Tip tanımları (`checklistItems: { id: string; ... }[]`) sorgu değildir.
      if (/checklistItems:\s*\{[^}]*:\s*(string|number|boolean)/.test(line)) return

      const window = lines.slice(i, i + 6).join("\n")
      if (!window.includes("ACTIVE_CHECKLIST_ITEM")) {
        offenders.push(`${rel}:${i + 1} → ${line.trim()}`)
      }
    })
  }

  expect(offenders).toEqual([])
})
