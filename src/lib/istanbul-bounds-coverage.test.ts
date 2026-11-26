import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { skipString, skipTemplate, stripComments } from "./testing/strip-comments"

/**
 * #874 / #904 — gün ve ay sınırları sürecin saat diliminde kurulamaz.
 *
 * `d.setHours(0, 0, 0, 0)`, `new Date(y, m, d)` ve `new Date(d.toDateString())`
 * ÇALIŞAN sürecin gece yarısını verir. Prod konteyneri UTC'de koşarsa "bugün"
 * TR 03:00'te başlar: TR 00:00–03:00 arasındaki kayıtlar önceki güne düşer,
 * dünkü hatırlatma gecikmiş sayılmaz, ayın ilk üç saati önceki aya yazılır.
 * TR saatli bir geliştirici makinesinde her şey doğru göründüğü için ne tip
 * denetimi ne de göz yakalar. Sınırlar `@/lib/istanbul-time` ile kurulur
 * (`istanbulDayBounds`, `istanbulDayStart`, `istanbulMonthStart` …).
 *
 * Kapsam: `src/` altındaki tüm `.ts`/`.tsx` — `"use client"` dosyaları dahil;
 * `*.test.ts(x)` ve `*.e2e.ts` taranmaz. Yorumlar tek geçişte silinir: dize,
 * şablon dizesi ve düzenli ifade içi olduğu gibi kopyalanır, yani
 * `accept="image/*"` bir yorum açmaz, `"https://…"` satırı kesmez; satır ve blok
 * yorumları (satır sonundakiler dahil) satır numarası korunarak boşaltılır.
 *
 * Kurallar:
 *   1. `new Date(` İKİ ya da daha fazla üst düzey argümanla — `new Date(y, m, d)`.
 *      Argümanlar `()[]{}` derinliği izlenerek, dize/şablon dizesi içi atlanarak
 *      ayrılır; yani `new Date(Date.UTC(y, m, d))`, `new Date(a.getTime() + DAY)`
 *      ve ``new Date(`${a}, ${b}`)`` geçer. Çok satırlı çağrı da yakalanır.
 *   2. `.setHours(` — argümanından bağımsız (saat ataması da süreç saatindedir).
 *   3. `.toDateString(` — çıktısı yeniden ayrıştırılınca süreç gece yarısıdır.
 *
 * Bilinen sınırlar — bu bir sezgisel tarama, ayrıştırıcı değil; şunları GÖRMEZ:
 *   - `new Date(...parts)` — yayılan (spread) tek argümanın kaç değer taşıdığı
 *     kaynaktan okunamaz.
 *   - `.setDate(` / `.setMonth(` ile göreli kaydırma (yerel takvimde gün/ay atlar).
 *   - `getDate()` / `getDay()` / `getMonth()` ile yapılan takvim aritmetiği.
 *   - Saat dilimi eki olmayan dize ayrıştırma (`new Date("2026-11-25T00:00:00")`
 *     süreç saatinde okunur — kullanıcı girdisi `parseIstanbulLocalDateTime` ile).
 *   - Sunucuda date-fns `startOfDay` / `startOfMonth` — `"use client"` olmayan
 *     dosyada date-fns importunu `format-date-coverage.test.ts` zaten engeller.
 *   - Düzenli ifade başlangıcı önceki simgeden tahmin edilir; JSX metnindeki tek
 *     bir kesme işareti (`Atölye'nin`) o satırın geri kalanını dize sanar — etkisi
 *     satırla sınırlıdır ve yalnız o satırdaki yorumun taranmasına yol açar.
 *
 * Yeni bir ihlal görürsen `@/lib/istanbul-time`'taki yardımcıyı kullan. Bilinçli
 * bir istisnaysa `INTENTIONAL`a gerekçesiyle ekle; taramayı gevşetme.
 */

const SRC = join(import.meta.dir, "..")

/**
 * Kalıcı, bilinçli istisnalar — her biri en az 15 karakterlik bir gerekçeyle.
 * Bunlar istemci bileşenidir ve tarayıcının yerel takvimiyle çalışan takvim
 * ilkelini besler.
 */
const INTENTIONAL: Record<string, string> = {
  "components/ui/date-picker.tsx":
    "takvim ilkelinin startMonth/endMonth yıl sınırları (tarayıcı yerel takvimi); gün sınırı değil",
  "components/ui/date-range-picker.tsx":
    "takvim ilkelinin startMonth/endMonth yıl sınırları (tarayıcı yerel takvimi); gün sınırı değil",
  "components/ui/date-time-picker.tsx":
    "kullanıcının tarayıcıda seçtiği yerel anı kurar (setHours) + takvim ilkelinin yıl sınırları",
}

/**
 * Henüz `@/lib/istanbul-time`'a geçmemiş dosyalar; gerekçe geçişi taşıyan
 * issue'yu (`#123`) anar. Boşaldıkça silinir — paralel PR'lardan hangisi ikinci
 * merge olursa kaydı o siler.
 */
const PENDING_MIGRATION: Record<string, string> = {}

/** `(`'ten başlayan çağrının boş olmayan üst düzey argümanlarını verir. */
function callArguments(source: string, openIndex: number): string[] {
  const args: string[] = []
  let depth = 0
  let start = openIndex + 1
  let i = openIndex
  while (i < source.length) {
    const ch = source[i]
    if (ch === '"' || ch === "'") {
      i = skipString(source, i)
      continue
    }
    if (ch === "`") {
      i = skipTemplate(source, i)
      continue
    }
    if (ch === "(" || ch === "[" || ch === "{") {
      depth++
    } else if (ch === ")" || ch === "]" || ch === "}") {
      depth--
      if (depth === 0) {
        args.push(source.slice(start, i))
        break
      }
    } else if (ch === "," && depth === 1) {
      args.push(source.slice(start, i))
      start = i + 1
    }
    i++
  }
  return args.map((arg) => arg.trim()).filter(Boolean)
}

/** Kaynak metindeki süreç-saati gece yarısı ihlallerini `satır → kod` olarak döndürür. */
export function findLocalMidnightViolations(rawSource: string): string[] {
  const source = stripComments(rawSource)
  const lineOf = (index: number) => source.slice(0, index).split("\n").length
  const snippet = (index: number) => {
    const end = source.indexOf("\n", index)
    return source.slice(index, end === -1 ? undefined : end).trim()
  }
  const found: { index: number; text: string }[] = []

  for (const match of source.matchAll(/\bnew\s+Date\s*\(/g)) {
    const open = match.index + match[0].length - 1
    if (callArguments(source, open).length >= 2) found.push({ index: match.index, text: snippet(match.index) })
  }

  for (const match of source.matchAll(/\.(?:setHours|toDateString)\s*\(/g)) {
    found.push({ index: match.index, text: snippet(match.index) })
  }

  return found
    .sort((a, b) => a.index - b.index)
    .map(({ index, text }) => `${lineOf(index)} → ${text}`)
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) && !/\.e2e\.ts$/.test(entry)) out.push(full)
  }
  return out
}

function scanSource(): Map<string, string[]> {
  const result = new Map<string, string[]>()
  for (const file of walk(SRC)) {
    const rel = file.slice(SRC.length + 1)
    const violations = findLocalMidnightViolations(readFileSync(file, "utf8"))
    if (violations.length) result.set(rel, violations)
  }
  return result
}

describe("findLocalMidnightViolations", () => {
  test("süreç saatinde gece yarısı kuran çağrıları yakalar", () => {
    const bad = [
      `const a = new Date(now.getFullYear(), now.getMonth(), 1)`,
      `const b = new Date(y, m, d, 0, 0, 0, 0)`,
      `const c = new Date(currentYear - 60, 0)`,
      `const d = new Date(\n  now.getFullYear(),\n  now.getMonth(),\n)`,
      `today.setHours(0, 0, 0, 0)`,
      `next.setHours(hours, minutes)`,
      `const e = new Date(new Date().toDateString())`,
      `const f = new Date([a, b][0], 0)`,
    ]
    for (const source of bad) expect(findLocalMidnightViolations(source)).toHaveLength(1)
  })

  test("tek argümanlı ya da UTC'de kurulan tarihleri geçirir", () => {
    const good = [
      `const a = new Date()`,
      `const b = new Date(Date.UTC(y, m, d))`,
      `const c = new Date(a.getTime() + 7 * DAY_MS)`,
      "const d = new Date(`${year}-${month}, ${day}`)",
      `const e = new Date("2026, 11, 25")`,
      `const f = new Date(\n  Date.UTC(y, m + 1, 1) - OFFSET,\n)`,
      `const g = new Date(Math.max(a, b))`,
      `const h = new Date({ a: 1, b: 2 }.a)`,
      `next.setUTCHours(0, 0, 0, 0)`,
      `const i = d.toLocaleDateString("tr-TR", { timeZone: "Europe/Istanbul" })`,
      `const j = new DateRange(a, b)`,
      `// eski: today.setHours(0, 0, 0, 0)`,
      `/* new Date(y, m, d) */ const k = 1`,
    ]
    for (const source of good) expect(findLocalMidnightViolations(source)).toEqual([])
  })

  test("ihlalin satır numarasını ve sırasını verir", () => {
    expect(
      findLocalMidnightViolations(`const a = 1\n\nconst b = new Date(y, m, d)\nb.setHours(0, 0, 0, 0)`)
    ).toEqual(["3 → new Date(y, m, d)", "4 → .setHours(0, 0, 0, 0)"])
  })

  test("dize, şablon ve düzenli ifade içindeki /* ya da // yorum açmaz", () => {
    expect(
      findLocalMidnightViolations(`<Input accept="image/*" />\nconst a = new Date(y, m, d)\nx.setHours(0,0,0,0)\n{/* c */}`)
    ).toEqual(["2 → new Date(y, m, d)", "3 → .setHours(0,0,0,0)"])
    expect(findLocalMidnightViolations("const g = `src/*`\nconst a = new Date(y, m)")).toEqual(["2 → new Date(y, m)"])
    expect(findLocalMidnightViolations(`const u = "https://x"; d.setHours(0)`)).toHaveLength(1)
    expect(findLocalMidnightViolations(`const r = s.replace(/["'/*]/g, ""); d.setHours(0)`)).toHaveLength(1)
    expect(findLocalMidnightViolations(`const r = s.split(/\\/\\//); d.setHours(0)`)).toHaveLength(1)
  })

  test("satır sonundaki ve çok satırlı çağrı içindeki yorumlar taranmaz", () => {
    expect(findLocalMidnightViolations(`const d = new Date(\n  ms, // eski: y, m, d\n)`)).toEqual([])
    expect(findLocalMidnightViolations(`const d = new Date(ms /* , m, d */)`)).toEqual([])
    expect(findLocalMidnightViolations(`const a = 1 // today.setHours(0, 0, 0, 0)`)).toEqual([])
    expect(
      findLocalMidnightViolations(`/* çok\nsatırlı */ const b = 1\nb.setHours(0)`)
    ).toEqual(["3 → .setHours(0)"])
  })
})

describe("gün/ay sınırları Türkiye takvimine göre kurulur (#874, #904)", () => {
  const violations = scanSource()

  test("listede olmayan dosyada süreç-saati gece yarısı yok", () => {
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
      if (!existsSync(join(SRC, rel))) stale.push(`${rel} (dosya yok — listeden sil)`)
      else if (!violations.has(rel)) stale.push(`${rel} (ihlal kalmadı — listeden sil)`)
    }
    expect(stale).toEqual([])
  })

  test("bir dosya iki listede birden olamaz", () => {
    expect(Object.keys(INTENTIONAL).filter((rel) => rel in PENDING_MIGRATION)).toEqual([])
  })

  test("her bilinçli istisna gerekçeli", () => {
    const thin = Object.entries(INTENTIONAL).filter(([, reason]) => reason.trim().length < 15)
    expect(thin).toEqual([])
  })

  test("her bekleyen geçiş bir issue'ya bağlı", () => {
    const unlinked = Object.entries(PENDING_MIGRATION).filter(([, reason]) => !/#\d+/.test(reason))
    expect(unlinked).toEqual([])
  })
})
