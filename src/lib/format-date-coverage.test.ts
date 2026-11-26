import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { stripComments } from "@/lib/testing/strip-comments"

/**
 * #861 — tarih/saat biçimlemesi saat dilimi vermeden yapılamaz.
 *
 * `toLocaleTimeString("tr-TR")` çıktıyı ÇALIŞAN sürecin saat diliminde üretir.
 * Prod konteyneri UTC'de koşarsa 09:00 randevu 06:00 görünür, gece 00:00–03:00
 * arası tarihler bir önceki güne düşer; TR saatli bir geliştirici makinesinde
 * her şey doğru göründüğü için ne tip denetimi ne de göz yakalar. Biçimleme
 * `@/lib/format-date` üzerinden yapılır (Europe/Istanbul sabit).
 *
 * Kurallar (yorumlar taranmaz, `*.test.ts` taranmaz):
 *   1. `.toLocaleDateString(` / `.toLocaleTimeString(` / `Intl.DateTimeFormat(`
 *      çağrısının dengeli parantez aralığında `timeZone` yoksa ihlal
 *      (`timeZone: "UTC"` bilinçli bir seçim olarak geçer).
 *   2. `.toLocaleString(` — argümanında tarih seçeneği (`dateStyle`, `hour`,
 *      `month` …) varsa ya da alıcısı `new Date(` ile başlıyor / `…At`,
 *      `…Date`, `…Time` ile bitiyorsa, `timeZone` yoksa ihlal. Sayı
 *      biçimlemesi (`used.toLocaleString("tr-TR")`) kapsam dışıdır.
 *   3. `"use client"` olmayan dosyada `from "date-fns"` ihlal: date-fns süreç
 *      saat diliminde biçimler, sunucuda bu UTC'dir.
 *
 * Bilinen sınırlar — bu bir sezgisel tarama, ayrıştırıcı değil:
 *   - Seçenekler bir değişkenden gelirse (`toLocaleDateString("tr-TR", opts)`)
 *     `timeZone` görünmez; çağrı ihlal sayılır, listeye gerekçesiyle girer.
 *   - Adı `At/Date/Time` ile bitmeyen bir Date değişkeninde seçeneksiz
 *     `d.toLocaleString()` yakalanmaz.
 *   - `"use client"` dosyalarındaki date-fns `format(` tarayıcı saatinde
 *     biçimler; bu kapı onu denetlemez.
 *
 * Yeni bir ihlal görürsen `@/lib/format-date`'teki yardımcıyı kullan. Bilinçli
 * bir istisnaysa `INTENTIONAL`a gerekçesiyle ekle; taramayı gevşetme.
 */

const SRC = join(import.meta.dir, "..")

/** Kuralın muaf tuttuğu tek dosya: biçimleyicilerin kendisi. */
const EXEMPT = new Set(["lib/format-date.ts"])

/**
 * Kalıcı, bilinçli istisnalar — her biri gerekçeli. `ui/date-picker.tsx`,
 * `ui/date-range-picker.tsx` ve `ui/date-time-picker.tsx` burada değil: yalnız
 * date-fns kullanırlar ve `"use client"` oldukları için kural 3'e takılmazlar.
 */
const INTENTIONAL: Record<string, string> = {
  "components/ui/calendar.tsx": "takvim ilkeli; günleri ve ay adlarını kullanıcının yerel saatinde çizer",
}

/** Henüz `@/lib/format-date`'e geçmemiş çağrılar. Boşaldıkça silinir. */
const PENDING_MIGRATION: Record<string, string> = {
  "app/admin/active-impersonations.tsx": "#875",
  "app/admin/admin-billing.tsx": "#875",
  "app/admin/admin-requests.tsx": "#875",
  "app/admin/admin-workshops.tsx": "#875",
  "app/admin/admins/page.tsx": "#875",
  "app/admin/audit/page.tsx": "#875",
  "app/admin/catalog/[id]/page.tsx": "#875",
  "app/admin/catalog/import/import-wizard.tsx": "#875",
  "app/admin/catalog/orders/orders-list.tsx": "#875",
  "app/admin/communications/communication-log-table.tsx": "#875",
  "app/admin/data.ts": "#875",
  "app/admin/health/page.tsx": "#875",
  "app/admin/live-chat/live-chat-inbox.tsx": "#875",
  "app/admin/sales/sales-console.tsx": "#875",
  "app/admin/status/status-incident-console.tsx": "#875",
  "app/admin/workshop-actions.tsx": "#875",
  "app/admin/workshop-activity-tables.tsx": "#875",
  "app/admin/workshops/[id]/page.tsx": "#875",
  "components/billing/manage-plan-dialog.tsx": "#875",
  "components/communications/communication-log-list.tsx": "#875",
  "components/damage/vehicle-damage-map.tsx": "#875",
  "components/intake/approval-timeline.tsx": "#875",
  "components/intake/damage-capture.tsx": "#875",
  "components/intake/public-share-page.tsx": "#875",
  "components/orders/order-activity-log.tsx": "#875",
  "components/orders/order-list.tsx": "#875",
  "components/orders/parts-labor-grid.tsx": "#875",
  "components/orders/parts-request-panel.tsx": "#875",
  "components/parts/supplier-price-dialog.tsx": "#875",
  "components/purchases/purchase-detail-dialog.tsx": "#875",
  "components/purchases/purchases-list.tsx": "#875",
  "components/quotes/quote-list.tsx": "#875",
  "components/site-assistant/views/live-chat-view.tsx": "#875",
  "components/technician/labor-session-card.tsx": "#875",
  "components/technician/technician-dashboard.tsx": "#875",
  "components/technician/technician-order-detail.tsx": "#875",
  "components/vehicles/public-vehicle-passport.tsx": "#875",
  "lib/blog/format.ts": "#875",
}

/** `(`'ten başlayıp dengeli kapanan `)`'e kadar olan metni verir. */
function balancedArgs(source: string, openIndex: number): string {
  let depth = 0
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i]
    if (ch === "(") depth++
    else if (ch === ")") {
      depth--
      if (depth === 0) return source.slice(openIndex, i + 1)
    }
  }
  return source.slice(openIndex)
}

/** `.toLocaleString(` öncesindeki alıcı ifadesini (ör. `order.createdAt`) verir. */
function receiverBefore(source: string, dotIndex: number): string {
  let i = dotIndex - 1
  let depth = 0
  while (i >= 0) {
    const ch = source[i]
    if (ch === ")" || ch === "]") depth++
    else if (ch === "(" || ch === "[") {
      if (depth === 0) break
      depth--
    } else if (depth === 0 && !/[\w$.?!]/.test(ch)) break
    i--
  }
  const receiver = source.slice(i + 1, dotIndex)
  return /\bnew\s+$/.test(source.slice(0, i + 1)) ? `new ${receiver}` : receiver
}

const USE_CLIENT = /^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*["']use client["']/
const DATE_OPTION = /\b(dateStyle|timeStyle|hour|minute|day|month|year|weekday)\b/
const DATE_RECEIVER = /^new\s+Date\(|(At|Date|Time)\)?$/

/** Kaynak metindeki ihlalleri `satır → kod` olarak döndürür. */
function findDateFormatViolations(rawSource: string): string[] {
  const source = stripComments(rawSource)
  const lineOf = (index: number) => source.slice(0, index).split("\n").length
  const snippet = (index: number) => source.slice(index, source.indexOf("\n", index) === -1 ? undefined : source.indexOf("\n", index)).trim()
  const found: string[] = []

  for (const match of source.matchAll(/\.toLocale(?:Date|Time)String\(|\bIntl\.DateTimeFormat\(/g)) {
    const open = match.index + match[0].length - 1
    if (!balancedArgs(source, open).includes("timeZone")) {
      found.push(`${lineOf(match.index)} → ${snippet(match.index)}`)
    }
  }

  for (const match of source.matchAll(/\.toLocaleString\(/g)) {
    const open = match.index + match[0].length - 1
    const args = balancedArgs(source, open)
    if (args.includes("timeZone")) continue
    const receiver = receiverBefore(source, match.index)
    if (DATE_OPTION.test(args) || DATE_RECEIVER.test(receiver)) {
      found.push(`${lineOf(match.index)} → ${snippet(match.index)}`)
    }
  }

  if (!USE_CLIENT.test(rawSource)) {
    for (const match of source.matchAll(/from\s+["']date-fns["']/g)) {
      found.push(`${lineOf(match.index)} → ${snippet(match.index)} (sunucu dosyası)`)
    }
  }

  return found
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

function scanSource(): Map<string, string[]> {
  const result = new Map<string, string[]>()
  for (const file of walk(SRC)) {
    const rel = file.slice(SRC.length + 1)
    if (EXEMPT.has(rel)) continue
    const violations = findDateFormatViolations(readFileSync(file, "utf8"))
    if (violations.length) result.set(rel, violations)
  }
  return result
}

describe("findDateFormatViolations", () => {
  test("saat dilimsiz biçimlemeyi yakalar", () => {
    const bad = [
      `const a = d.toLocaleDateString("tr-TR")`,
      `const b = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })`,
      `const c = new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(d)`,
      `const e = order.createdAt.toLocaleString("tr-TR")`,
      `const f = new Date(iso).toLocaleString("tr-TR")`,
      `const g = value.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit" })`,
      `const h = (order.shippedAt).toLocaleString()`,
    ]
    for (const source of bad) expect(findDateFormatViolations(source)).toHaveLength(1)
  })

  test("saat dilimi verilen ya da tarih olmayan çağrıları geçirir", () => {
    const good = [
      `const a = d.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })`,
      `const b = new Intl.DateTimeFormat("tr-TR", {\n  timeZone: TR_TIME_ZONE,\n  hour: "2-digit",\n})`,
      `const c = new Intl.DateTimeFormat("tr-TR", { month: "long", timeZone: "UTC" })`,
      `const d = used.toLocaleString("tr-TR")`,
      `const e = amount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })`,
      `const f = order.createdAt.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })`,
      `// eski: d.toLocaleDateString("tr-TR")`,
      `/* d.toLocaleTimeString() */ const g = 1`,
    ]
    for (const source of good) expect(findDateFormatViolations(source)).toEqual([])
  })

  test("date-fns yalnız istemci dosyasında serbest", () => {
    const importLine = `import { format } from "date-fns"\n`
    expect(findDateFormatViolations(importLine)).toHaveLength(1)
    expect(findDateFormatViolations(`"use client"\n\n${importLine}`)).toEqual([])
    expect(findDateFormatViolations(`// açıklama\n'use client'\n${importLine}`)).toEqual([])
    expect(findDateFormatViolations(`import { tr } from "date-fns/locale"\n`)).toEqual([])
  })

  test("dizedeki /* sonrasını taramadan düşürmez (#941)", () => {
    expect(
      findDateFormatViolations('<Input accept="image/*" />\nconst a = d.toLocaleDateString("tr-TR")\n{/* c */}'),
    ).toHaveLength(1)
  })

  test("ihlalin satır numarasını verir", () => {
    expect(findDateFormatViolations(`const a = 1\n\nconst b = d.toLocaleDateString()`)).toEqual([
      "3 → .toLocaleDateString()",
    ])
  })
})

describe("tarih/saat biçimleme saat dilimi verir (#861)", () => {
  const violations = scanSource()

  test("listede olmayan dosyada saat dilimsiz biçimleme yok", () => {
    const offenders: string[] = []
    for (const [rel, found] of violations) {
      if (rel in INTENTIONAL || rel in PENDING_MIGRATION) continue
      for (const line of found) offenders.push(`${rel}:${line}`)
    }
    expect(offenders).toEqual([])
  })

  test("listelerde bayat kayıt yok — her dosya var ve hâlâ en az bir ihlal içeriyor", () => {
    const stale: string[] = []
    for (const rel of [...Object.keys(INTENTIONAL), ...Object.keys(PENDING_MIGRATION)]) {
      if (!existsSync(join(SRC, rel))) stale.push(`${rel} (dosya yok)`)
      else if (!violations.has(rel)) stale.push(`${rel} (ihlal kalmadı — listeden sil)`)
    }
    expect(stale).toEqual([])
  })

  test("bir dosya iki listede birden olamaz", () => {
    expect(Object.keys(INTENTIONAL).filter((rel) => rel in PENDING_MIGRATION)).toEqual([])
  })

  test("her kayıt gerekçeli", () => {
    for (const reason of [...Object.values(INTENTIONAL), ...Object.values(PENDING_MIGRATION)]) {
      expect(reason.trim().length).toBeGreaterThan(3)
    }
  })
})
