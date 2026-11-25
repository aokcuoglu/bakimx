import { describe, expect, test } from "bun:test"
import { relative, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { eachTsx, jsxOpeningTags, utilityCore, type JsxOpeningTag } from "./jsx-source-scan"

/**
 * #888 — form kontrolleri çağrı yerinde ezilmez (docs/ui-control-sizing.md).
 *
 * Ölçü (yükseklik, köşe, yazı boyutu, satır yüksekliği, dolgu) ve görünüm
 * (zemin, kenarlık kaldırma/kalınlığı, gölge, halka, outline, ağırlık) yalnız
 * bileşenden ve `size` varyantından gelir. Yoğun yer `size="sm"` /
 * `size="compact"` seçer, `className` yazmaz. `className` yerleşim içindir:
 * genişlik (`w-*`, `max-w-*`, `min-w-*`), flex/grid (`flex-1`, `grow`,
 * `col-span-*`), dış boşluk, yatay dolgu (ikon yeri için `pl-9`), hizalama
 * (`text-right`), `tabular-nums`, `font-mono`, `uppercase`, `tracking-*`,
 * metin rengi. CSS modülü sınıfı (`className={styles.x}`) içini göremediğimiz
 * için ihlal sayılır; gerekçeli istisna ister.
 *
 * Tarama, açılış etiketinin kendi `className` ifadesindeki dizge sabitlerini
 * okur (`cn(...)`, koşul ve şablon dizgileri dahil; ayrıştırıcı:
 * `jsx-source-scan.ts`). `!` önek/soneki ve `md:` / `data-[…]:` önekleri
 * sınıfı gizlemez. `className`'i bir kontrole ileten sarmalayıcı
 * (`FilterSelect`, `CitySelect`) kendisi `CONTROLS`'ta olmak zorundadır,
 * böylece çağrı yeri ezmesi sarmalayıcı üzerinden de yakalanır.
 *
 * Bilinen kör noktalar (taranmaz; gerekçeleri yerinde yazılı):
 * - Sabite ya da fonksiyona çıkarılmış sınıf: `fieldClass("plate")`
 *   (entry-vehicle-fields, inline-create-modal — OCR düşük güven uyarı tonu).
 * - Ata öğeden torun kontrolü biçimleyen seçiciler: parts-labor-grid
 *   `GHOST_ROW` / `META_FIELD_*` ve mobil kart ad alanı
 *   (`[&_[data-slot=input]]:border-transparent`, `[&_input]:!text-muted-foreground`,
 *   ad alanının `px-0` + `font-medium`'u). Bunlar hayalet satır görünümüdür:
 *   kenarlık/zemin şeffaf, odakta geri gelir. Ölçü, köşe ve yazı boyutu bu
 *   seçicilerle ezilmez (#888'de 11px ve `rounded-md` kaldırıldı); yenisi
 *   eklenmez.
 *
 * #889 aynı kapıyı `Button` / `InputGroupButton` için genişletecek: bileşeni
 * `CONTROLS`'a, gerekiyorsa yasak aileyi `FORBIDDEN`'a eklemek yeterli.
 */

/** Kapsamdaki kontroller ve onlara `className` ileten sarmalayıcılar. */
export const CONTROLS = [
  "Input",
  "InputGroup",
  "InputGroupInput",
  "InputGroupTextarea",
  "Textarea",
  "SelectTrigger",
  "AutocompleteInput",
  "AutocompleteInputGroup",
  "ComboboxInput",
  "ComboboxChips",
  // Sarmalayıcılar: className'i SelectTrigger / ComboboxInput'a iletir.
  // CitySelect / DistrictSelect onu `...props` ile LocationCombobox'a geçirir
  // (yayılımla iletim otomatik tespit edilmez, elle listelenir).
  "FilterSelect",
  "LocationCombobox",
  "CitySelect",
  "DistrictSelect",
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
  // Keyfi değerde yalnız uzunluk: `text-[17px]`, `text-(length:--x)`; renk
  // (`text-[color:…]`, `text-(--x)`) yerleşim/renk serbestliği içinde kalır.
  { name: "yazı boyutu", pattern: /^text-(?:xs|sm|base|lg|\d?xl|\[(?:length:|[\d.])[^\]]*\]|\(length:[^)]*\))$/ },
  { name: "satır yüksekliği", pattern: /^leading-/ },
  { name: "dolgu", pattern: /^p[ytb]?-/ },
  { name: "kenarlık kaldırma", pattern: /^border(?:-[trblxy])?-(?:0|none|transparent)$/ },
  { name: "kenarlık kalınlığı", pattern: /^border(?:-[trblxy])?-(?:2|4|8|\[[^\]]*px\])$/ },
  { name: "zemin", pattern: /^bg-/ },
  { name: "gölge", pattern: /^shadow(?:-|$)/ },
  { name: "odak halkası", pattern: /^ring(?:-|$)/ },
  { name: "outline", pattern: /^outline(?:-|$)/ },
  { name: "yazı ağırlığı", pattern: /^font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/ },
  { name: "keyfi özellik", pattern: /^\[(?:height|min-height|border-radius|font-size|font-weight|line-height|background|box-shadow|padding|outline)/ },
]

/** Etiketin yasak sınıfları: `["h-7 (yükseklik)", "styles.input (CSS modülü)", …]`. */
export function violations(tag: Pick<JsxOpeningTag, "name" | "classLiterals" | "cssModuleRefs">): string[] {
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
  for (const ref of tag.cssModuleRefs) found.push(`${ref} (CSS modülü)`)
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
  {
    file: "components/layout/global-search-box.tsx",
    tag: "Input",
    allow: ["styles.input"],
    reason:
      "Genel arama paletinin başlık girdisi: paletin kendi 53px başlık bandında kenarlıksız, dolgusuz satır (design-pattern-esantral §6, #712 ölçümü). Kutu değil, paletin parçası.",
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

type ScannedTag = JsxOpeningTag & { file: string }

/** Ağaç bir kez ayrıştırılır; testler aynı sonucu paylaşır. */
let scanned: { controls: ScannedTag[]; rawInputs: ScannedTag[] } | null = null

function scan() {
  if (scanned) return scanned
  const controls: ScannedTag[] = []
  const rawInputs: ScannedTag[] = []
  eachTsx(
    SRC,
    (path, source) => {
      const file = relative(SRC, path).split(sep).join("/")
      for (const tag of jsxOpeningTags(source, [...CONTROLS, "input"], path)) {
        ;(tag.name === "input" ? rawInputs : controls).push({ ...tag, file })
      }
    },
    (path) => OUT_OF_SCOPE.some((dir) => `${relative(SRC, path)}${sep}`.startsWith(dir))
  )
  scanned = { controls, rawInputs }
  return scanned
}

type Row = { file: string; tag: string; line: number; hits: string[] }

function callSiteViolations(): Row[] {
  return scan().controls.flatMap((tag) => {
    const hits = violations(tag)
    return hits.length ? [{ file: tag.file, tag: tag.name, line: tag.line, hits }] : []
  })
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
      `<Textarea className="${"focus-visible:" + "ring-destructive/30"}" />`,
      '<Input className="focus-visible:ring-0" />',
      `<Input className="${"outline-" + "none"}" />`,
      '<Input className="leading-5" />',
      '<Input className="border-2" />',
      `<FilterSelect className="${"text-" + "[15px]"} w-full" />`,
      '<Input className={styles.input} />',
    ]
    for (const source of bad) {
      const tags = jsxOpeningTags(`import styles from "./x.module.css"\n${source}`, CONTROLS)
      expect(tags.length).toBeGreaterThan(0)
      expect(violations(tags[0])).not.toEqual([])
    }

    const good = [
      '<Input size="compact" className="w-24 text-right tabular-nums" />',
      '<Input className="pl-9 pr-9" />',
      '<Textarea className="min-h-20 resize-none" />',
      `<SelectTrigger className="w-full min-w-0 ${"md:" + "max-w-60"}" />`,
      '<InputGroup className="flex-1 font-mono uppercase tracking-wider" />',
      '<Input className="text-muted-foreground" />',
      `<Input className="${"text-[color:var(--" + "primary)]"}" />`,
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
   * `className`'i bir kontrole ileten bileşen (`<SelectTrigger className={className}>`)
   * çağrı yerinin ezmesini kapıdan saklar; sarmalayıcının kendisi taranmalı.
   */
  test("className ileten sarmalayıcılar kapının kapsamında", () => {
    const missing = scan()
      .controls.filter((tag) => tag.forwardsClassName && !CONTROLS.includes(tag.owner as Control))
      .map((tag) => `${tag.file}:${tag.line} <${tag.name}> sahibi ${tag.owner ?? "(adsız)"}`)
    expect(missing).toEqual([])
  })

  /**
   * Ham `<input>` yalnız iki biçimde kalır (ui-contract.test.ts tipi sınırlar):
   * form gönderimi için `type="hidden"` ve bir `Button`'un tetiklediği gizli
   * dosya seçici (`type="file"` + `className="hidden"`). Görünen her alan
   * `Input` / `Checkbox` / `Switch`'tir.
   */
  test("ham dosya seçiciler görünmez, düğmeyle tetiklenir", () => {
    const offenders = scan()
      .rawInputs.filter((tag) => {
        const type = tag.attributes.get("type")
        if (type === '"hidden"') return false
        return !(type === '"file"' && tag.classLiterals.some((l) => l.split(/\s+/).includes("hidden")))
      })
      .map((tag) => `${tag.file}:${tag.line} type=${tag.attributes.get("type") ?? "(yok)"}`)
    expect(offenders).toEqual([])
  })
})
