import { describe, expect, test } from "bun:test"
import { relative, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { eachTsx, jsxOpeningTags, utilityCore, type JsxOpeningTag } from "./jsx-source-scan"

/**
 * #888 — form kontrolleri çağrı yerinde ezilmez (docs/ui-control-sizing.md).
 *
 * Ölçü (yükseklik, köşe, yazı boyutu, dolgu) ve görünüm (zemin, kenarlık
 * kaldırma, gölge, ağırlık) yalnız bileşenden ve `size` varyantından gelir.
 * Yoğun yer `size="sm"` / `size="compact"` seçer, `className` yazmaz.
 * `className` yerleşim içindir: genişlik (`w-*`, `max-w-*`, `min-w-*`),
 * flex/grid (`flex-1`, `grow`, `col-span-*`), dış boşluk, yatay dolgu (ikon
 * yeri için `pl-9`), hizalama (`text-right`), `tabular-nums`, `font-mono`,
 * `uppercase`, `tracking-*`, metin rengi.
 *
 * Tarama, açılış etiketinin kendi `className` ifadesindeki dizge sabitlerini
 * okur (`cn(...)`, koşul ve şablon dizgileri dahil; ayrıştırıcı:
 * `jsx-source-scan.ts`). `!` önek/soneki ve `md:` / `data-[…]:` önekleri
 * sınıfı gizlemez. Sabite çıkarılmış ya da prop'tan gelen sınıfı görmez.
 *
 * #889 aynı kapıyı `Button` / `InputGroupButton` için genişletecek: bileşeni
 * `CONTROLS`'a, gerekiyorsa yasak aileyi `FORBIDDEN`'a eklemek yeterli.
 */

/** Kapsamdaki kontroller. */
export const CONTROLS = [
  "Input",
  "InputGroup",
  "InputGroupInput",
  "InputGroupTextarea",
  "Textarea",
  "SelectTrigger",
  "AutocompleteInput",
  "ComboboxInput",
  "ComboboxChips",
] as const

type Control = (typeof CONTROLS)[number]

type Family = {
  /** Raporda görünen ad. */
  name: string
  /** Sınıf çekirdeğiyle eşleşir (`utilityCore`). */
  pattern: RegExp
  /** Bu bileşenlerde ailenin şu çekirdekleri serbesttir. */
  allow?: { tags: readonly Control[]; pattern: RegExp; reason: string }
}

/** Yasak sınıf aileleri. */
export const FORBIDDEN: readonly Family[] = [
  { name: "yükseklik", pattern: /^h-/ },
  {
    name: "en az yükseklik",
    pattern: /^min-h-/,
    allow: {
      tags: ["Textarea", "InputGroupTextarea"],
      pattern: /^min-h-\d+(?:\.5)?$/,
      reason: "Textarea içerik yüksekliği bir yerleşim kararıdır; yalnız Tailwind ölçeğinden (min-h-20, keyfi değer değil)",
    },
  },
  { name: "kare ölçü", pattern: /^size-/ },
  { name: "köşe", pattern: /^rounded(?:-|$)/ },
  { name: "yazı boyutu", pattern: /^text-(?:xs|sm|base|lg|\d?xl|\[.*\]|\(length:.*\))$/ },
  { name: "dolgu", pattern: /^p[ytb]?-/ },
  { name: "kenarlık kaldırma", pattern: /^border(?:-[trblxy])?-(?:0|none|transparent)$/ },
  { name: "zemin", pattern: /^bg-/ },
  { name: "gölge", pattern: /^shadow(?:-|$)/ },
  { name: "yazı ağırlığı", pattern: /^font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/ },
  { name: "keyfi özellik", pattern: /^\[(?:height|min-height|border-radius|font-size|font-weight|background|box-shadow|padding)/ },
]

/** Etiketin yasak sınıfları: `["h-7 (yükseklik)", …]`. */
export function violations(tag: Pick<JsxOpeningTag, "name" | "classLiterals">): string[] {
  const found: string[] = []
  for (const literal of tag.classLiterals) {
    for (const token of literal.split(/\s+/).filter(Boolean)) {
      const core = utilityCore(token)
      for (const family of FORBIDDEN) {
        if (!family.pattern.test(core)) continue
        if (family.allow?.tags.includes(tag.name as Control) && family.allow.pattern.test(core)) continue
        found.push(`${token} (${family.name})`)
      }
    }
  }
  return found
}

type Exception = {
  /** `src/`'ye göre yol. */
  file: string
  tag: Control
  /** Yalnız bu sınıflar serbest; aynı etikete eklenen başka ezme yine düşer. */
  allow: readonly string[]
  reason: string
}

/**
 * Bilinçli istisnalar. Her satır bir gerekçe taşır; artık eşleşmeyen satır
 * testi düşürür (bayat istisna kalmaz).
 */
export const EXCEPTIONS: readonly Exception[] = [
  {
    file: "components/settings/branding-form.tsx",
    tag: "Input",
    allow: ["p-1"],
    reason:
      'type="color" renk kuyusu: p-1 rengi çerçeveden ayırır. Yükseklik bileşenden, genişlik w-(--control-h) ile kare.',
  },
  {
    file: "components/intake/smart-capture-registration.tsx",
    tag: "Input",
    allow: ["bg-warning/10"],
    reason:
      "OCR düşük güven durumu: uyarı tonu bir durum rengi, ölçü değil (entry-vehicle-fields ve inline-create-modal aynı tonu fieldClass ile verir).",
  },
]

const SRC = fileURLToPath(new URL("../../", import.meta.url))
const OUT_OF_SCOPE = [
  // Kontrollerin kendisi: ölçüyü burada tanımlar.
  `components${sep}ui${sep}`,
  // Landing / pazarlama yüzeyi kendi --mk-* ölçeğini taşır.
  `components${sep}sections${sep}`,
  `components${sep}marketing${sep}`,
]

type Row = { file: string; tag: string; line: number; hits: string[] }

function scan(visit: (file: string, source: string, path: string) => void) {
  eachTsx(
    SRC,
    (path, source) => visit(relative(SRC, path).split(sep).join("/"), source, path),
    (path) => OUT_OF_SCOPE.some((dir) => `${relative(SRC, path)}${sep}`.startsWith(dir))
  )
}

function callSiteViolations() {
  const rows: Row[] = []
  scan((file, source, path) => {
    for (const tag of jsxOpeningTags(source, CONTROLS, path)) {
      const hits = violations(tag)
      if (hits.length) rows.push({ file, tag: tag.name, line: tag.line, hits })
    }
  })
  return rows
}

/** `"h-7 (yükseklik)"` → `"h-7"` */
const hitClass = (hit: string) => hit.slice(0, hit.lastIndexOf(" ("))

describe("form kontrolleri çağrı yerinde ezilmez (#888)", () => {
  test("kapı bilinen ihlalleri yakalar, yerleşim sınıflarına dokunmaz", () => {
    // Tailwind içerik tarayıcısı test dosyalarını da gezer: kaynakta başka yerde
    // geçmeyen sınıflar parçalanarak yazılır, üretilen CSS'e ölü kural girmesin.
    const bad = [
      '<Input className="h-7 text-sm" />',
      '<Input className={cn("w-full", dense && "rounded-lg")} />',
      `<InputGroup className={\`flex-1 \${open ? "${"md:" + "py-1.5"}" : ""}\`} />`,
      '<SelectTrigger className="!h-7" />',
      `<Textarea className="${"min-h-" + "[80px]"}" />`,
      '<AutocompleteInput render={<Input />} className="bg-muted" />',
      '<ComboboxInput className="shadow-none border-transparent" />',
      '<InputGroupInput className="font-semibold" />',
      `<Input className="${"data-[size=sm]:" + "h-7!"}" />`,
      '<Input className="border-0 p-0" />',
      '<ComboboxChips className="w-full min-h-7" />',
    ]
    for (const source of bad) {
      const tags = jsxOpeningTags(source, CONTROLS)
      expect(tags.length).toBeGreaterThan(0)
      expect(violations(tags[0])).not.toEqual([])
    }

    const good = [
      '<Input size="compact" className="w-24 text-right tabular-nums" />',
      '<Input className="pl-9 pr-9" />',
      '<Textarea className="min-h-20 resize-none" />',
      `<SelectTrigger className="w-full min-w-0 ${"md:" + "max-w-60"}" />`,
      '<InputGroup className="flex-1 font-mono uppercase tracking-wider" />',
      // İç içe öğe kendi etiketi olarak taranır; dıştakini kirletmez.
      '<AutocompleteInput render={<Input className="w-full" />} />',
    ]
    for (const source of good) {
      for (const tag of jsxOpeningTags(source, CONTROLS)) expect(violations(tag)).toEqual([])
    }
  })

  test("Input / Textarea / Select / InputGroup çağrı yerlerinde ölçü ezmesi yok", () => {
    const offenders = callSiteViolations().flatMap((row) => {
      const allowed = new Set(
        EXCEPTIONS.filter((e) => e.file === row.file && e.tag === row.tag).flatMap((e) => e.allow)
      )
      const hits = row.hits.filter((hit) => !allowed.has(hitClass(hit)))
      return hits.length ? [`${row.file}:${row.line} <${row.tag}> ${hits.join(", ")}`] : []
    })
    expect(offenders).toEqual([])
  })

  test("istisna listesinde bayat ya da gerekçesiz satır yok", () => {
    const rows = callSiteViolations()
    const stale = EXCEPTIONS.filter(
      (e) =>
        !e.allow.every((cls) =>
          rows.some((row) => row.file === e.file && row.tag === e.tag && row.hits.some((hit) => hitClass(hit) === cls))
        )
    ).map((e) => `${e.file} <${e.tag}> ${e.allow.join(" ")}`)
    expect(stale).toEqual([])
    for (const e of EXCEPTIONS) expect(e.reason.length).toBeGreaterThan(20)
  })

  /**
   * Ham `<input>` yalnız iki biçimde kalır (ui-contract.test.ts tipi sınırlar):
   * form gönderimi için `type="hidden"` ve bir `Button`'un tetiklediği gizli
   * dosya seçici (`type="file"` + `className="hidden"`). Görünen her alan
   * `Input` / `Checkbox` / `Switch`'tir.
   */
  test("ham dosya seçiciler görünmez, düğmeyle tetiklenir", () => {
    const offenders: string[] = []
    scan((file, source, path) => {
      for (const tag of jsxOpeningTags(source, ["input"], path)) {
        const type = tag.attributes.get("type")
        if (type === '"hidden"') continue
        if (type === '"file"' && tag.classLiterals.some((l) => l.split(/\s+/).includes("hidden"))) continue
        offenders.push(`${file}:${tag.line} type=${type ?? "(yok)"}`)
      }
    })
    expect(offenders).toEqual([])
  })
})
