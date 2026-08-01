import { expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

import { VISIBLE_PHOTO } from "./photo-visibility"

/**
 * Fotoğraf silme SOFT'tur: satır DB'de kalır, yalnızca `deletedAt` işaretlenir.
 * Bu yüzden fotoğraf OKUYAN her sorgu `VISIBLE_PHOTO` ile filtrelemek zorunda —
 * unutulursa kullanıcının sildiği kare galeride/PDF'te/public sayfada geri
 * görünür ve TypeScript bunu yakalayamaz (alan opsiyonel).
 *
 * Aşağıdaki tarama, kaynakta filtresiz kalan bir okuma yolunu derleme yerine
 * testte patlatır. Yeni bir okuma yolu eklerken ya `VISIBLE_PHOTO` kullan ya da
 * bilinçli bir istisnaysa `INTENTIONALLY_UNFILTERED`a gerekçesiyle ekle.
 */

const SRC = join(import.meta.dir, "..", "..")

/** Filtresiz olması BİLİNÇLİ olan okuma yolları — her biri gerekçeli. */
const INTENTIONALLY_UNFILTERED: Record<string, string> = {
  // Silinmiş karenin `photo_deleted` denetim kaydı personel-içi işlem
  // geçmişinde görünmeye devam etmeli.
  "lib/orders/activity.ts": "audit trail must still resolve deleted photo ids",
  // Kalem komple silinirken TÜM fotoğrafları (silinmişler dahil) temizlenir.
  "app/(app)/orders/actions.ts": "removeOrderItemAction hard-deletes every photo of the item",
  // Sürüm/polling hash'i: silme de bir değişikliktir, sayıma dahil kalmalı.
  "app/api/orders/[id]/version/route.ts": "version hash must change when a photo is soft-deleted",
  // Silme aksiyonunun kendisi silinmiş kaydı da bulabilmeli (idempotent olsun).
  "app/(app)/intakes/actions.ts": "removePhotoAction resolves already-deleted rows to stay idempotent",
}

/** Fotoğraf okuduğuna işaret eden desenler. */
const READ_PATTERNS = [
  /prisma\.vehiclePhoto\.(findMany|findFirst|findUnique|count)/,
  /tx\.vehiclePhoto\.(findMany|findFirst|findUnique|count)/,
  /^\s*photos:\s*(\{|true)/,
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

test("VISIBLE_PHOTO soft-delete edilmiş kareleri gizler", () => {
  expect(VISIBLE_PHOTO).toEqual({ deletedAt: null })
})

test("fotoğraf okuyan her sorgu VISIBLE_PHOTO ile filtreler", () => {
  const offenders: string[] = []

  for (const file of walk(SRC)) {
    const rel = file.slice(SRC.length + 1)
    if (rel in INTENTIONALLY_UNFILTERED) continue

    const source = readFileSync(file, "utf8")
    const lines = source.split("\n")

    lines.forEach((line, i) => {
      if (!READ_PATTERNS.some((p) => p.test(line))) return
      // Tip tanımları (`photos: { id: string; ... }[]`) sorgu değildir.
      if (/photos:\s*\{[^}]*:\s*(string|number|boolean)/.test(line)) return

      // Filtre aynı satırda ya da sorgu bloğunun ilk birkaç satırında olabilir.
      const window = lines.slice(i, i + 6).join("\n")
      if (!window.includes("VISIBLE_PHOTO")) {
        offenders.push(`${rel}:${i + 1} → ${line.trim()}`)
      }
    })
  }

  expect(offenders).toEqual([])
})
