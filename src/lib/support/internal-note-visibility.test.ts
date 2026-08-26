import { expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

/**
 * `SupportRequest.internalNote` YALNIZ /admin konsolunda görünür (BAK-98).
 *
 * TypeScript bunu koruyamaz: alan opsiyoneldir ve herhangi bir `select`'e
 * eklenmesi derlemede sorunsuz geçer. Müşteriye açık bir yüzey modeli okumaya
 * başladığı gün not da yanında gider — bu yüzden kapı davranış değil KAYNAK
 * taramasıdır (aynı sınıf için mevcut örnek: `src/lib/intake/photo-visibility.test.ts`).
 *
 * Yeni bir okuma yolu eklerken: konsol içindeyse allowlist'e gerekçesiyle ekle,
 * değilse notu okuma.
 */

const SRC = join(import.meta.dir, "..", "..")

/** SupportRequest'e dokunmasına İZİN VERİLEN dosyalar — her biri gerekçeli. */
const ALLOWED: Record<string, string> = {
  "app/admin/data.ts": "yönetici konsolunun liste sorgusu — notu okuyan tek yer",
  "app/admin/actions.ts": "konsol mutasyonları (durum, bağlama, atama, not)",
  "app/admin/workshops/[id]/page.tsx": "yönetici atölye detayında destek talebi sayısını gösterir; internalNote okumaz",
  "app/api/support-request/route.ts": "public form YALNIZ yazar; not alanına hiç dokunmaz",
  "lib/support/workshop-link.ts": "e-posta ile kiracı eşleştirme — Workshop/User okur, talebi değil",
}

/** SupportRequest'e erişim izleri: doğrudan model ve ilişki üzerinden okuma. */
const ACCESS_PATTERNS = [
  /\b(?:prisma|tx)\.supportRequest\b/,
  /^\s*supportRequests:\s*(\{|true)/,
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

test("SupportRequest'i yalnız yönetici konsolu okur", () => {
  const offenders: string[] = []

  for (const file of walk(SRC)) {
    const rel = file.slice(SRC.length + 1)
    if (rel in ALLOWED) continue

    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (ACCESS_PATTERNS.some((p) => p.test(line))) {
          offenders.push(`${rel}:${i + 1} → ${line.trim()}`)
        }
      })
  }

  expect(offenders).toEqual([])
})

test("public destek formu internalNote alanına dokunmaz", () => {
  const source = readFileSync(join(SRC, "app", "api", "support-request", "route.ts"), "utf8")
  expect(source).not.toContain("internalNote")
})

test("konsol dışında hiçbir dosya SupportRequest.internalNote seçmez", () => {
  /** Notu okumasına/yazmasına izin verilen konsol dosyaları. */
  const consoleFiles = new Set([
    "app/admin/data.ts", // liste sorgusu
    "app/admin/actions.ts", // not kaydetme aksiyonu
    "app/admin/admin-requests.tsx", // konsol satırı — notu YALNIZ burada çizer
  ])
  const offenders: string[] = []

  for (const file of walk(SRC)) {
    const rel = file.slice(SRC.length + 1)
    if (consoleFiles.has(rel)) continue

    const source = readFileSync(file, "utf8")
    // Yalnız SupportRequest bağlamındaki `internalNote` ilgilendiriyor; aynı ad
    // Quote/Appointment/Supplier gibi kiracı-içi modellerde de var ve onlar
    // zaten personel yüzeyleri.
    if (/supportRequest[\s\S]{0,400}?internalNote/i.test(source)) {
      offenders.push(rel)
    }
  }

  expect(offenders).toEqual([])
})
