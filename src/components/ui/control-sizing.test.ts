import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { relative, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { cn } from "@/lib/utils"
import { eachTsx, jsxOpeningTags } from "./jsx-source-scan"
import { tabsListVariants } from "./tabs"

const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8")

/**
 * e-santral ölçeği (docs/design-pattern-esantral.md, kullanıcı kararı 22-11):
 * telefonda iOS dokunma ölçüsü (44px), md+ masaüstü veri ekranlarında kompakt
 * (36px). Breakpoint yalnız md'dir; çağrı yerinde boyut ezilmez.
 */

/** `size: {` bloğunun gövdesini kaba ama yeterli bir şekilde çıkarır. */
function buttonSizeBlock() {
  const source = read("./button.tsx")
  const start = source.indexOf("      size: {")
  const end = source.indexOf("      },\n    },\n    defaultVariants:")
  expect(start).toBeGreaterThan(-1)
  expect(end).toBeGreaterThan(start)
  return source.slice(start, end)
}

describe("kontrol ölçeği — e-santral (mobil 44px / masaüstü 36px)", () => {
  const globals = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8")

  test("--control-* değişkenleri telefonda 44px, md+ 36px", () => {
    const [mobile, desktop] = globals.split("@media (min-width: 768px)")
    expect(mobile).toContain("--control-h: 2.75rem;")
    expect(mobile).toContain("--control-fs: 17px;")
    expect(desktop).toContain("--control-h: 2.25rem;")
    expect(desktop).toContain("--control-fs: 15px;")
  })

  test("Button ölçüsünü değişkenden alır, md: sınıfı kullanmaz", () => {
    const block = buttonSizeBlock()
    expect(block).toContain('default: "h-(--control-h) gap-1.5 px-(--control-px)"')
    expect(block).toContain('sm: "h-(--control-h-sm) ')
    expect(block).toContain('lg: "h-(--control-h-lg) ')
    expect(block).toContain('xl: "h-(--control-h-xl) ')
    expect(block).toContain('xs: "h-(--control-h-xs) ')
    expect(block).toContain('compact: "h-(--control-h-xs) ')
    expect(block).toContain('icon: "size-(--control-h) rounded-full"')
    expect(block).toContain('"icon-sm": "size-(--control-h-sm) rounded-full"')
    expect(block).toContain('"icon-lg": "size-(--control-h-lg) rounded-full"')
    // Kırılımlı boyut sınıfı çağrı yerindeki h-auto / px- düzeltmesini ezer.
    expect(read("./button.tsx")).not.toMatch(/(?:sm|md|lg|xl):(?:h|size|min-h|px|pl|pr|text|rounded)-/)
    expect(block).not.toContain("has-data-[icon=")
  })

  /**
   * #889 — düğme olmayan kalıplar çağrı yerinde `h-auto` / `p-0` / `rounded-*`
   * yazmasın diye kendi `size`'ları var; alan görünümlü tetikleyici `field`
   * variant'ıyla girdinin köşesini taşır.
   */
  test("satır içi, liste satırı ve karo için size; alan görünümlü tetikleyici (#889)", () => {
    const block = buttonSizeBlock()
    expect(block).toContain('inline: "gap-1 rounded-sm p-0 text-[length:inherit] leading-[inherit]"')
    expect(block).toContain('row: "min-h-(--control-h) justify-start gap-3 rounded-md px-3 py-2.5 text-left ')
    expect(block).toContain('tile: "flex-col gap-1.5 overflow-hidden rounded-md p-0 ')
    const button = read("./button.tsx")
    expect(button).toContain("border border-input bg-card font-normal text-foreground focus-visible:ring-4 focus-visible:ring-ring/20 aria-invalid:ring-4 aria-invalid:ring-destructive/10")
    expect(button).toContain('{ variant: "field", className: "rounded-(--control-radius)" }')
    // compact alan tetikleyicisi compact girdiyle aynı metin (telefonda 16px).
    expect(button).toContain('{ variant: "field", size: "compact", className: "text-(length:--control-fs-field-xs)" }')
    // row satırları variant'tan bağımsız aynı çerçeve kutusunda; hayalet satır soluk değil.
    expect(button).toContain('{ size: "row", variant: [...NO_BORDER_VARIANTS], className: "border border-transparent" }')
    expect(button).toContain('{ size: "row", variant: "ghost", className: "text-foreground dark:text-foreground" }')
    // Vitrin her boyutu gösterir.
    const page = read("../../app/design/page.tsx")
    expect(page).toContain('data-testid="button-sizes"')
    for (const size of ["inline", "row", "tile"]) expect(page).toContain(`size="${size}"`)
  })

  /**
   * #925 — ton variant'tan gelir (çağrı yeri kapısı control-call-sites.test.ts);
   * grup içi düğme grubun ölçüsünü izler; tarih seçici tetikleyicisi alan
   * görünümündedir.
   */
  test("ton variant'ları, grup içi düğme ölçüsü ve tarih seçici tetikleyicisi (#925)", () => {
    const button = read("./button.tsx")
    for (const key of ['"destructive-outline":', "tint:", '"on-photo":', '"on-photo-ghost":']) {
      expect(button).toContain(`        ${key}`)
    }
    // Kenarlıksız ton variant'ları row satırında şeffaf 1px çerçeve alır.
    const noBorder = button.slice(button.indexOf("const NO_BORDER_VARIANTS"), button.indexOf("] as const"))
    expect(noBorder).toContain('"tint",')
    expect(noBorder).toContain('"on-photo-ghost",')

    const group = read("./input-group.tsx")
    const start = group.indexOf("const inputGroupButtonVariants = cva(")
    expect(start).toBeGreaterThan(-1)
    const block = group.slice(start, group.indexOf("\n)\n", start))
    expect(block).toContain("h-[calc(var(--control-h)-4px)]")
    expect(block).toContain("size-[calc(var(--control-h)-4px)]")
    expect(block).not.toMatch(/\b(?:h|size)-[678]\b/)
    expect(group).not.toContain("inputGroupButtonFit")

    for (const file of ["./date-picker.tsx", "./date-range-picker.tsx", "./date-time-picker.tsx"]) {
      const source = read(file)
      expect(source).toContain('variant="field"')
      expect(source).not.toContain("font-normal")
    }

    const page = read("../../app/design/page.tsx")
    for (const variant of ["destructive-outline", "tint"]) expect(page).toContain(`["${variant}", `)
    for (const variant of ["on-photo", "on-photo-ghost"]) expect(page).toContain(`variant="${variant}"`)
  })

  test("Input, Select, Textarea ve InputGroup değişkenden ölçülür", () => {
    for (const file of ["./input.tsx", "./select.tsx", "./textarea.tsx", "./input-group.tsx"]) {
      expect(read(file)).not.toMatch(/(?:sm|md|lg|xl):(?:h|min-h|px|pl|pr|text|rounded)-/)
    }
    expect(read("./input.tsx")).toContain('"h-(--control-h) w-full min-w-0')
    const select = read("./select.tsx")
    expect(select).toContain('size?: "sm" | "default" | "compact"')
    expect(select).toContain("data-[size=default]:h-(--control-h)")
    expect(select).toContain("data-[size=sm]:h-(--control-h-sm)")
    expect(select).toContain("data-[size=compact]:h-(--control-h-xs)")
    expect(read("./input-group.tsx")).toContain("relative flex h-(--control-h) w-full min-w-0")
  })

  test("Input / InputGroup size varyantı değişkenleri yeniden bağlar (#888)", () => {
    const input = read("./input.tsx")
    expect(input).toContain('type InputSize = "default" | "sm" | "compact" | "lg"')
    expect(input).toContain('Omit<React.ComponentProps<"input">, "size">')
    expect(input).toContain("data-size={size}")
    expect(input).toContain("data-[size=sm]:[--control-h:var(--control-h-sm)]")
    expect(input).toContain("data-[size=compact]:[--control-h:var(--control-h-xs)]")
    expect(input).toContain("data-[size=compact]:[--control-fs:var(--control-fs-field-xs)]")
    expect(input).toContain("data-[size=lg]:[--control-h:var(--control-h-lg)]")
    const group = read("./input-group.tsx")
    expect(group).toContain("data-size={size}")
    expect(group).toContain("inputSizeClasses,")
    // InputGroupInput ölçüyü gruptan miras alır; kendi size'ı yok.
    expect(group).toContain('}: Omit<React.ComponentProps<"input">, "size">) {')
    expect(read("./combobox.tsx")).toContain("<InputGroup size={size}")
  })

  test("compact metin girdisi telefonda 16px altına inmez (iOS odak yakınlaştırması)", () => {
    const [mobile, desktop] = globals.split("@media (min-width: 768px)")
    const px = (block: string) => Number(block.match(/--control-fs-field-xs: (\d+)px;/)?.[1])
    expect(px(mobile)).toBeGreaterThanOrEqual(16)
    expect(px(desktop)).toBe(14)
  })

  test("kalem düzenleyicisi kontrol ölçeğini yerelde ezmez", () => {
    const partsLaborGrid = read("../orders/parts-labor-grid.tsx")

    expect(partsLaborGrid).not.toContain("h-9")
  })
})

describe("dokunma ölçülü seçiciler — size=\"control\" (#846)", () => {
  test("Toggle ve Tabs primitive'leri ölçüyü değişkenden alır", () => {
    const toggle = read("./toggle.tsx")
    const tabs = read("./tabs.tsx")
    expect(toggle).toContain('control: "h-(--control-h) min-w-(--control-h)')
    // #889: seçenek kartı boyutu; outline seçili = birincil ton, segment = ray + beyaz kart.
    expect(toggle).toContain('row: "min-h-(--control-h) justify-start gap-3 rounded-md px-3 py-2.5 text-left ')
    expect(toggle).toContain("data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary-strong")
    expect(toggle).toContain("data-[state=on]:bg-card data-[state=on]:text-foreground")
    expect(read("./toggle-group.tsx")).toContain("data-[variant=segment]:bg-muted data-[variant=segment]:p-0.5")
    expect(tabs).toContain("group-data-[size=control]/tabs-list:h-(--control-h)")
    // #854: segment sekmenin seçili tetikleyicisi Toggle segment gibi gri rayda beyaz kart.
    expect(tabs).toContain("data-[state=active]:bg-card data-[state=active]:text-foreground")
    expect(tabs).not.toContain("data-[state=active]:bg-background")
    for (const source of [toggle, tabs]) {
      expect(source).not.toMatch(/(?:sm|md|lg|xl):(?:h|size|min-h)-/)
    }
  })

  /**
   * Çağrı yeri mandalı: açılış etiketinde `h-7!` / `!h-7` / `md:h-7!` /
   * `size-7!` (ve `min-h`) yasak. Etiket TypeScript ayrıştırıcısıyla sınırlanır
   * (ok fonksiyonlu prop'lar ve `[&>svg]` etiketi bölmez).
   * Sınırı: sabite çıkarılmış sınıfları (`const cls = "h-7!"`) görmez.
   */
  const TOGGLE_TABS = ["ToggleGroupItem", "ToggleGroup", "Toggle", "TabsList", "TabsTrigger"]
  const IMPORTANT = /(?:^|[\s"'`:])(?:h|min-h|size)-[^\s"'`]+!|!(?:h|min-h|size)-[^\s"'`]+/

  /** Açılış etiketlerinin metni (ortak ayrıştırıcı: jsx-source-scan.ts). */
  const openingTags = (source: string) => jsxOpeningTags(source, TOGGLE_TABS).map((tag) => tag.text)

  const srcRoot = fileURLToPath(new URL("../../", import.meta.url))

  test("mandal regex'i bilinen ihlalleri yakalar", () => {
    const bad = [
      '<ToggleGroupItem onClick={() => go()} className="h-7!">',
      '<TabsTrigger className="md:h-7!">',
      '<ToggleGroupItem className="size-7! [&>svg]:size-4">',
      '<ToggleGroupItem className="[&>svg]:size-4 !h-7">',
    ]
    for (const tag of bad) {
      const found = openingTags(tag)
      expect(found.length).toBe(1)
      expect(IMPORTANT.test(found[0])).toBe(true)
    }
    expect(IMPORTANT.test(openingTags('<TabsList size="control" className="grid h-auto">')[0])).toBe(false)
  })

  test("ToggleGroup / Toggle / Tabs çağrı yerinde yükseklik `!` ile ezilmez", () => {
    const offenders: string[] = []
    eachTsx(srcRoot, (path, source) => {
      for (const tag of openingTags(source)) {
        if (IMPORTANT.test(tag)) offenders.push(`${path}: ${tag.slice(0, 80)}`)
      }
    })
    expect(offenders).toEqual([])
  })

  test('`line` sekme `size="control"` ile kontrol ölçüsüne bağlanır (#854)', () => {
    const tabs = read("./tabs.tsx")
    const lineControl = "group-data-[variant=line]/tabs-list:group-data-[size=control]/tabs-list:"
    // Tetikleyici: 44 / 36px, kontrol metni, e-santral seçili sekme (mavi metin + 2px mavi çizgi).
    for (const cls of [
      "h-(--control-h)",
      "px-3",
      "text-(length:--control-fs)",
      "data-[state=active]:bg-transparent",
      "data-[state=active]:text-primary-strong",
      "after:bg-primary",
      "group-data-horizontal/tabs:after:bottom-0",
      "group-data-horizontal/tabs:after:h-0.5",
      "group-data-vertical/tabs:after:w-0.5",
    ]) {
      expect(tabs).toContain(`${lineControl}${cls}`)
    }
    // Şerit: line'ın sabit 44px bandı yerine h-auto (yükseklik tetikleyiciden).
    const list = cn(tabsListVariants({ variant: "line", size: "control" }))
    expect(list).toContain("group-data-horizontal/tabs:h-auto")
    expect(list).not.toContain("group-data-horizontal/tabs:h-11")
    // Varsayılan line (28px) masaüstü yoğun yüzey için korunur.
    expect(tabs).toContain("group-data-[variant=line]/tabs-list:h-7")
    // Vitrin dokunma ölçülü sekme ve seçicileri gösterir.
    const page = read("../../app/design/page.tsx")
    expect(page).toContain('data-testid="selector-sizes"')
    expect(page).toContain('<TabsList variant="line" size="control"')
  })

  /**
   * #854 — telefonda dokunulan seçici dokunma ölçüsünü taşır: `TabsList`
   * `size="control"`, `ToggleGroup` ve tek başına `Toggle` `size="control"`
   * (seçenek kartı `row`; grup ölçüsü öğelere bağlamdan geçer). Upstream
   * varsayılanı (line sekme 28px, Toggle 32px) yalnız masaüstü yoğun yüzeyde
   * kalır ve aşağıda gerekçesiyle listelenir; yeni seçici ya ölçek alır ya da
   * listeye girer. Artık eşleşmeyen satır testi düşürür.
   * CI'daki `quality` işi Playwright koşmaz (test / lint / typecheck / build),
   * bu yüzden dokunma hedefinin CI bekçisi bu kaynak kapısıdır; piksel ölçümü
   * QA'nın 390px yürüyüşündedir.
   */
  const TOUCH_SIZES: Record<string, readonly string[]> = {
    TabsList: ['"control"'],
    ToggleGroup: ['"control"', '"row"'],
    Toggle: ['"control"', '"row"'],
  }
  const DENSE_SELECTORS: readonly { file: string; tag: keyof typeof TOUCH_SIZES; reason: string }[] = [
    {
      file: "components/orders/order-table-column-header.tsx",
      tag: "ToggleGroup",
      reason:
        "İş emri tablosunun kolon başlığı sıralama menüsü: tablo yalnız lg+ çizilir (order-list `hidden lg:block`), telefonda kart listesi var — masaüstü yoğun süzgeç, öğeler `sm` (32px).",
    },
    {
      file: "app/design/record-patterns.tsx",
      tag: "TabsList",
      reason:
        "Tasarım vitrininin kayıt kalıbı: varsayılan `line` (28px) masaüstü yoğun sekme örneği; dokunma ölçülü karşılığı aynı sayfadaki `selector-sizes` bloğunda.",
    },
    {
      file: "components/orders/work-order-detail.tsx",
      tag: "TabsList",
      reason:
        "İş emri detayının sayfa sekmeleri order-detail.module.css `.tab` ile zaten --control-h (44 / 36px); #911 sayfayı sekmesiz tek sayfaya çeviriyor, satır o PR'la kalkar.",
    },
  ]
  /** Kapsam dışı: primitive'lerin kendisi ve kendi --mk-* ölçeğini taşıyan pazarlama yüzeyi. */
  const TOUCH_OUT_OF_SCOPE = [`components${sep}ui${sep}`, `components${sep}sections${sep}`, `components${sep}marketing${sep}`]

  function unsizedSelectors() {
    const rows: { file: string; tag: string; line: number }[] = []
    eachTsx(
      srcRoot,
      (path, source) => {
        const file = relative(srcRoot, path).split(sep).join("/")
        for (const tag of jsxOpeningTags(source, Object.keys(TOUCH_SIZES), path)) {
          const size = tag.attributes.get("size")
          if (!size || !TOUCH_SIZES[tag.name].includes(size)) rows.push({ file, tag: tag.name, line: tag.line })
        }
      },
      (path) => TOUCH_OUT_OF_SCOPE.some((dir) => `${relative(srcRoot, path)}${sep}`.startsWith(dir))
    )
    return rows
  }

  test("telefonda dokunulan seçici size=\"control\" alır; yoğun masaüstü istisnaları gerekçeli (#854)", () => {
    const rows = unsizedSelectors()
    const offenders = rows
      .filter((row) => {
        const covered = DENSE_SELECTORS.some((e) => e.file === row.file && e.tag === row.tag)
        // Bir istisna satırı dosyadaki tek etiketi örter; ikinci ölçüsüz seçici yine düşer.
        const siblings = rows.filter((r) => r.file === row.file && r.tag === row.tag).length
        return !covered || siblings > 1
      })
      .map((row) => `${row.file}:${row.line} <${row.tag}>`)
    expect(offenders).toEqual([])

    const stale = DENSE_SELECTORS.filter((e) => !rows.some((row) => row.file === e.file && row.tag === e.tag))
    expect(stale.map((e) => `${e.file} <${e.tag}>`)).toEqual([])
    for (const e of DENSE_SELECTORS) expect(e.reason.length).toBeGreaterThan(20)
  })
})

describe("köşe yarıçapı", () => {
  const globals = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8")

  test("--radius uygulama kart değerinde (12px, #878)", () => {
    expect(globals).toContain("--radius: 0.75rem;")
  })

  test("--control-radius telefonda 10px, md+ 8px (#878)", () => {
    expect(globals).toMatch(/(?:^|\n):root\s*\{[^}]*--control-radius: 0\.625rem;/)
    expect(globals).toMatch(/@media \(min-width: 768px\)\s*\{\s*:root\s*\{[^}]*--control-radius: 0\.5rem;/)
  })

  test("Input, Select, Textarea, InputGroup ve Alert köşeyi değişkenden alır", () => {
    for (const file of ["./input.tsx", "./select.tsx", "./textarea.tsx", "./input-group.tsx", "./alert.tsx"]) {
      expect(read(file)).toContain("rounded-(--control-radius)")
      expect(read(file)).not.toContain("rounded-[12px]")
    }
  })
})
