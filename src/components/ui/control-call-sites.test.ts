import { describe, expect, test } from "bun:test"
import { relative, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { eachTsx, jsxOpeningTags, utilityCore, utilityVariants, type JsxOpeningTag } from "./jsx-source-scan"

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
 *
 * #889 — düğmeler (`Button`, `InputGroupButton` ve onlara `className` ileten
 * sarmalayıcılar) aynı tarayıcıyla, kendi kural setiyle (`BUTTON_FORBIDDEN`)
 * taranır. Ölçü, köşe, yazı boyutu/ağırlığı yalnız `size` / `variant`'tan
 * gelir; satır içi bağlantı `size="inline"`, çok satırlı liste satırı / seçenek
 * kartı `size="row"`, görsel karosu `size="tile"`. Seçili durum `variant`
 * değiştirerek verilir (`variant={on ? "secondary" : "outline"}`), zemin
 * `className` ile boyanmaz. Düğmede serbest kalanlar: yatay dolgu (`px-*`),
 * durum renkleri (`hover:` / `disabled:` / `aria-*:`), durum tonu
 * (`bg-destructive/10`), yüzen düğme gölgesi (`shadow-md`), `border-dashed`,
 * `font-mono`, kart üzerinde vurgu halkası (`hover:ring-2`).
 * `before:` / `after:` (şeffaf dokunma alanı) ve torun / kardeş seçicisi
 * (`[&_svg]:`, `[&>svg]:`, `[&+…]:`, `[&~…]:`, `*:`, `**:` — ikon boyutu gibi)
 * önekli sınıflar düğmenin kutusunu değiştirmez, sayılmaz. Öğenin kendisini
 * seçen `[&]:` / `[&:not(:disabled)]:` sayılır.
 * Seçiciler (`ToggleGroup`, `ToggleGroupItem`, `Toggle`) aynı kural setiyle
 * taranır: ölçü `size`'dan (`control`, seçenek kartı `row`), seçili görünüm
 * variant'tan (`outline` birincil ton, `segment` gri ray + beyaz kart).
 * Sekmeler (`TabsList`, `TabsTrigger`, #854) de aynı kural setiyle taranır:
 * ölçü `TabsList size="control"`dan (telefonda 44px, md+ 36px; `default`
 * segment ve `line` ile), şerit `h-auto`'yu, tetikleyici dolgusunu ve seçili
 * zemini varyanttan alır (segment seçili tetikleyici primitive'de `bg-card`,
 * `RuhsatDemoSection` dahil — ray `bg-card` ile boyanmaz). Sekmeler
 * arası yatay boşluk şeridin yerleşimidir (`gap-*`, şerit `px-*`). Çağrı yeri
 * şeride genişlik, grid/flex, `justify-start`, `border-b` çizgisi ve taşma
 * kaydırması verir.
 * Kör noktalar: `buttonVariants({ className })` çağrısı JSX değildir, taranmaz
 * (#889 anında tek kullanım `ui/` içinde). Başka modülden yeniden dışa
 * aktarılan CSS modülü nesnesi (`order-detail-surface`'ten gelen `detail`)
 * CSS modülü olarak tanınmaz; tarayıcı yalnız dosyadaki `*.module.css`
 * içe aktarımını görür.
 *
 * #925 — ton da variant'tan gelir: `border-destructive/*` (yıkıcı çerçeve →
 * `variant="destructive-outline"`), öneksiz `bg-primary/N` (birincil ton →
 * `variant="tint"`) ve `bg-white/*` / `border-white/*` / `bg-black/*` fotoğraf
 * üstü yüzeyler (→ `variant="on-photo"` / `"on-photo-ghost"`) yukarıdaki
 * serbest listeden çıktı. `hover:bg-primary/10` gibi birincil durum renkleri
 * serbest kalır; fotoğraf üstü ton her önekte yasaktır.
 *
 * #928 — dilim 2: yıkıcı ton (`text-destructive(-strong)`, `bg-destructive/N`)
 * ve uyarı tonu (`bg|border-warning/N`) her önekte yasak; satır içi yıkıcı
 * eylem `variant="destructive-ghost"`, sarı tonlu seçim `"warning-tint"`,
 * fotoğraf üstü galeri oku `"on-photo-scrim"`. Gri dinlenen satır çöp kutusu
 * `variant="destructive-ghost"` + `className="text-muted-foreground"` yazar
 * (twMerge variant'ın dinlenme rengini düşürür, hover kırmızıyı geri getirir).
 * `border-primary/N` öneksiz de variant'tandır (`"tint"`).
 *
 * #926 — akordeon (`Accordion`, `AccordionItem`, `AccordionTrigger`,
 * `AccordionContent`) kendi kural setiyle (`ACCORDION_FORBIDDEN`) taranır.
 * Görünüm kökte `variant` ile seçilir: `default` alt çizgili liste, `card`
 * her öğe ayrı, kenarlıksız kart (`ui/card.tsx`'in soluk halkası; durum tonu
 * halka rengiyle), `disclosure` kart görünümlü tek açılır başlık.
 * Tetikleyici yüksekliği (`--control-h`), dolgu, köşe, zemin, halka
 * kalınlığı, gölge, yazı boyutu/ağırlığı ve alt çizgi variant'tan gelir;
 * çağrı yerinde yazılmaz, iç parça (`**:data-[slot=accordion-…]:`,
 * `[&_[data-slot=accordion-…]]:`) de ezilmez. Düğmeden farkı: torun seçicisi
 * (`[&_button]:py-5`, `[&_a]:no-underline`, `[&_p]:mb-0`) atlanmaz, çekirdeği
 * aynı ailelerle taranır. Serbest olanlar: genişlik, flex/grid, `gap-*`,
 * `items-*`, `space-y-*`, dış boşluk, metin rengi (`hover:text-foreground`
 * dahil), ayraç çizgisi (`border-t`, `border-b`), kenarlık ve halka RENGİ
 * (kart durum tonu `ring-warning/30`), durum zemini (`bg-primary/[0.04]`),
 * `scroll-mt-*`, geçiş. Düzyazı içeriğinde (`AccordionContent`) satır aralığı
 * serbesttir.
 *
 * #950 — açılır bölüm (`Collapsible`, `CollapsibleTrigger`,
 * `CollapsibleContent`) kendi kural setiyle (`COLLAPSIBLE_FORBIDDEN`) taranır.
 * Açma/kapama animasyonu, taşma ve yükseklik primitive'dedir (içerik
 * `overflow-hidden` + `animate-collapsible-*`; `keepMounted` ise
 * `data-[state=closed]:hidden`): çağrı yerinde `animate-*`, `overflow-*`,
 * `h-*` / `min-h-*` / `max-h-*` ve çıplak `hidden` yazılmaz — gizleme/yükseklik
 * ezmesi odak halkasını kırpar ya da paneli kapalıyken bile gösterir. Panelin
 * yüzeyi (dolgu, zemin, kenarlık, `flex`/`grid`) serbesttir. Tetikleyici
 * `asChild` ile mevcut `Button`'ı sarar ve kendi `className`'ini taşımaz
 * (görünüm sarılan düğmenin `variant`/`size`'ından gelir).
 */

/** Kapsamdaki form kontrolleri ve onlara `className` ileten sarmalayıcılar. */
export const FIELD_CONTROLS = [
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
  "OrderItemUnitCombobox",
  "LocationCombobox",
  "CitySelect",
  "DistrictSelect",
] as const

/** Düğmeler (#889) ve onlara `className` ileten sarmalayıcılar. */
export const BUTTON_CONTROLS = [
  "Button",
  "InputGroupButton",
  // Sarmalayıcılar: className'i Button'a iletir.
  "ColorCard",
  "CookiePreferencesButton",
  "PhotoDeleteButton",
  "PrintButton",
  "StopLaborButton",
  "TechnicianAssign",
  // ui/sidebar: Button'a className iletir (çağrı yerleri ui/ dışında).
  "SidebarTrigger",
  // `triggerClassName`'i tetikleyici Button'a iletir.
  "FilterSheet",
  // ui/ sarmalayıcıları (#925): className'i tetikleyici Button'a iletir
  // (ui/ taranmadığı için iletim otomatik tespit edilmez, elle listelenir).
  "DatePicker",
  "DateRangePicker",
  "DateTimePicker",
  // ui/carousel (#928): className'i Button'a iletir, variant alır.
  "CarouselPrevious",
  "CarouselNext",
] as const

/** Seçiciler (#889): düğme kural setiyle taranır. */
export const TOGGLE_CONTROLS = ["ToggleGroup", "ToggleGroupItem", "Toggle"] as const

/** Sekmeler (#854): düğme kural setiyle taranır. */
export const TAB_CONTROLS = ["TabsList", "TabsTrigger"] as const

/** Akordeon (#926): kendi kural setiyle taranır. */
export const ACCORDION_CONTROLS = ["Accordion", "AccordionItem", "AccordionTrigger", "AccordionContent"] as const

/** Açılır bölüm (#950): kendi kural setiyle taranır. */
export const COLLAPSIBLE_CONTROLS = ["Collapsible", "CollapsibleTrigger", "CollapsibleContent"] as const

export const CONTROLS = [
  ...FIELD_CONTROLS,
  ...BUTTON_CONTROLS,
  ...TOGGLE_CONTROLS,
  ...TAB_CONTROLS,
  ...ACCORDION_CONTROLS,
  ...COLLAPSIBLE_CONTROLS,
] as const

type Control = (typeof CONTROLS)[number]

const usesButtonRules = (name: string) =>
  (BUTTON_CONTROLS as readonly string[]).includes(name) ||
  (TOGGLE_CONTROLS as readonly string[]).includes(name) ||
  (TAB_CONTROLS as readonly string[]).includes(name)

const usesAccordionRules = (name: string) => (ACCORDION_CONTROLS as readonly string[]).includes(name)

const usesCollapsibleRules = (name: string) => (COLLAPSIBLE_CONTROLS as readonly string[]).includes(name)

type Family = {
  /** Raporda görünen ad. */
  name: string
  /** Sınıf çekirdeğiyle eşleşir (`utilityCore`). */
  pattern: RegExp
  /** Bu bileşenlerde ailenin şu çekirdekleri serbesttir. */
  allow?: { tags: readonly Control[]; pattern: RegExp; reason: string }
  /**
   * Hangi öneklerle yasak (`BUTTON_FORBIDDEN`, `ACCORDION_FORBIDDEN`): varsayılan her önek;
   * `"base"` yalnız öneksiz ya da kırılım/koyu tema önekli (`md:`, `dark:`) —
   * `hover:` / `disabled:` / `aria-*:` durum rengi serbest; `"focus"` yalnız
   * `focus*:` önekli (düğmenin kendi odak halkası ezilmez); `"descendant"`
   * yalnız torun / kardeş seçicili (`[&_p]:`, `**:`) — akordeon içeriğinin
   * variant'tan gelen düzyazı aralığı ezilmez.
   */
  when?: "base" | "focus" | "descendant"
}

// Keyfi değerde yalnız uzunluk: `text-[17px]`, `text-(length:--x)`; renk
// (`text-[color:…]`, `text-(--x)`) yerleşim/renk serbestliği içinde kalır.
const TEXT_SIZE = /^text-(?:xs|sm|base|lg|\d?xl|\[(?:length:|[\d.])[^\]]*\]|\(length:[^)]*\))$/
const FONT_WEIGHT = /^font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/

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
  { name: "yazı boyutu", pattern: TEXT_SIZE },
  { name: "satır yüksekliği", pattern: /^leading-/ },
  { name: "dolgu", pattern: /^p[ytb]?-/ },
  { name: "kenarlık kaldırma", pattern: /^border(?:-[trblxy])?-(?:0|none|transparent)$/ },
  { name: "kenarlık kalınlığı", pattern: /^border(?:-[trblxy])?-(?:2|4|8|\[[^\]]*px\])$/ },
  { name: "zemin", pattern: /^bg-/ },
  { name: "gölge", pattern: /^shadow(?:-|$)/ },
  { name: "odak halkası", pattern: /^ring(?:-|$)/ },
  { name: "outline", pattern: /^outline(?:-|$)/ },
  { name: "yazı ağırlığı", pattern: FONT_WEIGHT },
  { name: "keyfi özellik", pattern: /^\[(?:height|min-height|border-radius|font-size|font-weight|line-height|background|box-shadow|padding|outline)/ },
]

/**
 * Düğme ailesinin yasak sınıfları (#889). Form kontrollerinden farkı: yatay
 * dolgu, durum rengi ve tonu, yüzen gölge, `border-dashed`, vurgu halkası
 * serbest; `h-full` / `size-full` (hücreyi dolduran düğme) yerleşimdir.
 */
export const BUTTON_FORBIDDEN: readonly Family[] = [
  { name: "yükseklik", pattern: /^h-(?!full$)/ },
  { name: "en az / en çok yükseklik", pattern: /^m(?:in|ax)-h-/ },
  { name: "kare ölçü", pattern: /^size-(?!full$)/ },
  { name: "köşe", pattern: /^rounded(?:-|$)/ },
  { name: "yazı boyutu", pattern: TEXT_SIZE },
  { name: "satır yüksekliği", pattern: /^leading-/ },
  { name: "dikey dolgu", pattern: /^p[ytb]?-/ },
  { name: "yazı ağırlığı", pattern: FONT_WEIGHT },
  { name: "odak halkası", pattern: /^(?:ring|outline)(?:-|$)/, when: "focus" },
  // Yarı saydam hâli de (`bg-background/95`, `bg-card/80`) aynı yüzey ezmesidir.
  { name: "zemin", pattern: /^bg-(?:background|card|transparent|muted)(?:\/(?:\d+|\[[^\]]+\]))?$/, when: "base" },
  { name: "kenarlık kaldırma", pattern: /^border(?:-[trblxy])?-(?:0|none|transparent)$/, when: "base" },
  { name: "gölge kaldırma", pattern: /^shadow-none$/, when: "base" },
  { name: "keyfi özellik", pattern: /^\[(?:height|min-height|max-height|border-radius|font-size|font-weight|line-height|padding)/ },
  // Ton variant'tan gelir (#925). Ad parantez içermez: `hitClass` sınıfı
  // son " (" ayracından keser.
  { name: 'yıkıcı çerçeve tonu → variant="destructive-outline"', pattern: /^border-destructive(?:\/(?:\d+|\[[^\]]+\]))?$/, when: "base" },
  { name: 'birincil ton → variant="tint"', pattern: /^(?:bg|border)-primary\/(?:\d+|\[[^\]]+\])$/, when: "base" },
  // Dilim 2 (#928): yıkıcı ve uyarı tonu her önekte variant'tan gelir; durum
  // önekli `hover:bg-destructive/10` de artık yazılmaz. Toggle / ToggleGroupItem /
  // TabsTrigger'da bu variant'lar yoktur: gerekçeli istisna ister (fuel-gauge). Gri dinlenen satır
  // simgesi `variant="destructive-ghost"` + `className="text-muted-foreground"`.
  { name: 'yıkıcı ton → variant="destructive-ghost" / "destructive-outline"', pattern: /^(?:text-destructive(?:-strong)?|bg-destructive(?:\/(?:\d+|\[[^\]]+\]))?)$/ },
  { name: 'uyarı ton → variant="warning-tint"', pattern: /^(?:bg|border)-warning(?:-foreground)?(?:\/(?:\d+|\[[^\]]+\]))?$/ },
  { name: 'fotoğraf üstü ton → variant="on-photo" / "on-photo-ghost" / "on-photo-scrim"', pattern: /^(?:bg|border)-(?:white|black)(?:\/(?:\d+|\[[^\]]+\]))?$/ },
]

/**
 * Akordeonun yasak sınıfları (#926). Ölçü ve görünüm kökteki `variant`'tan
 * gelir (`default` / `card` / `disclosure`); `className` yerleşim içindir.
 * Ad parantez içermez: `hitClass` sınıfı son " (" ayracından keser.
 */
export const ACCORDION_FORBIDDEN: readonly Family[] = [
  { name: "yükseklik", pattern: /^h-(?!full$)/ },
  { name: "en az / en çok yükseklik", pattern: /^m(?:in|ax)-h-/ },
  { name: "kare ölçü", pattern: /^size-/ },
  { name: "köşe", pattern: /^rounded(?:-|$)/ },
  { name: "yazı boyutu", pattern: TEXT_SIZE },
  { name: "yazı ağırlığı", pattern: FONT_WEIGHT },
  {
    name: "satır yüksekliği",
    pattern: /^leading-/,
    allow: {
      tags: ["AccordionContent"],
      pattern: /^leading-/,
      reason: "içerik düzyazıdır; satır aralığı tipografi kararı",
    },
  },
  { name: "dolgu → variant", pattern: /^p[xytblrse]?-/ },
  { name: "zemin", pattern: /^bg-(?:background|card|transparent|muted)(?:\/(?:\d+|\[[^\]]+\]))?$/, when: "base" },
  { name: "kenarlık kaldırma", pattern: /^border(?:-[trblxy])?-(?:0|none|transparent)$/ },
  { name: "gölge", pattern: /^shadow(?:-|$)/ },
  // Halka kalınlığı ve biçimi variant'tan; durum tonu halka RENGİYLE verilir
  // (`ring-warning/30`, `ring-success/30`) ve serbesttir.
  { name: "halka kalınlığı", pattern: /^ring(?:-(?:\d+(?:\.\d+)?|inset|\[(?:length:)?[\d.][^\]]*\]|\(length:[^)]*\)))?$/ },
  { name: "halka boşluğu", pattern: /^ring-offset(?:-|$)/ },
  { name: "outline", pattern: /^outline(?:-|$)/ },
  { name: "alt çizgi → variant", pattern: /^(?:no-)?underline$/ },
  { name: "keyfi özellik", pattern: /^\[(?:height|min-height|max-height|border-radius|font-size|font-weight|line-height|padding)/ },
  // Akordeonda torun seçicisi atlanmaz (`[&_button]:py-5` yukarıdaki dolgu
  // ailesine düşer); dış boşluk yalnız torunda — düzyazı aralığı — yasak.
  { name: "içerik aralığı → variant", pattern: /^-?m[trblxyse]?-/, when: "descendant" },
]

/**
 * Açılır bölümün yasak sınıfları (#950): animasyon, taşma, yükseklik ve gizleme
 * primitive'in işidir. Panel yüzeyi (dolgu, zemin, kenarlık) serbesttir.
 */
export const COLLAPSIBLE_FORBIDDEN: readonly Family[] = [
  { name: "animasyon", pattern: /^animate-/ },
  { name: "taşma", pattern: /^overflow(?:-|$)/ },
  { name: "yükseklik", pattern: /^h-(?!full$)/ },
  { name: "en az / en çok yükseklik", pattern: /^m(?:in|ax)-h-/ },
  { name: "gizleme", pattern: /^hidden$/ },
]

/**
 * Akordeonun iç parçasını (`**:data-[slot=accordion-trigger-icon]:size-5`,
 * `[&_[data-slot=accordion-trigger]]:py-5`) seçen sınıf; iki yazımı da kapsar.
 */
const ACCORDION_SLOT = "slot=accordion-"

/** Düğmenin kendi kutusunu değil sözde öğeyi / torunu / kardeşi biçimleyen önek. */
const DESCENDANT_VARIANT = /^(?:before|after|\*{1,2}|\[&[_>+~])/
/**
 * Durum değil, yalnız ekran / kap genişliği ve tema önekleri: `md:`,
 * `max-md:`, `min-[400px]:`, `max-[600px]:`, `@xl:`, `@max-md:`, `dark:`.
 */
const BASE_VARIANT = /^(?:(?:max-)?(?:sm|md|lg|xl|2xl)|(?:min|max)-\[[^\]]+\]|@.+|dark|print)$/

/** Etiketin yasak sınıfları: `["h-7 (yükseklik)", "styles.input (CSS modülü)", …]`. */
export function violations(tag: Pick<JsxOpeningTag, "name" | "classLiterals" | "cssModuleRefs">): string[] {
  const button = usesButtonRules(tag.name)
  const accordion = usesAccordionRules(tag.name)
  const collapsible = usesCollapsibleRules(tag.name)
  const families = collapsible
    ? COLLAPSIBLE_FORBIDDEN
    : accordion
      ? ACCORDION_FORBIDDEN
      : button
        ? BUTTON_FORBIDDEN
        : FORBIDDEN
  const found: string[] = []
  for (const literal of tag.classLiterals) {
    for (const token of literal.split(/\s+/).filter(Boolean)) {
      const core = utilityCore(token)
      const variants = utilityVariants(token)
      // Akordeonun kendi parçasını (ikon, tetikleyici) torun seçiciyle ezmek
      // de ölçü ezmesidir; seçici ne olursa olsun raporlanır.
      if (accordion && token.includes(ACCORDION_SLOT)) {
        found.push(`${token} (iç parça ezmesi)`)
        continue
      }
      // Düğmede torun seçicisi (ikon boyutu) kutuyu değiştirmez, atlanır;
      // akordeonda torun seçicisi variant'ın içeriğini ezer, taranır.
      if (button && variants.some((v) => DESCENDANT_VARIANT.test(v))) continue
      for (const family of families) {
        if (!family.pattern.test(core)) continue
        if (family.when === "base" && !variants.every((v) => BASE_VARIANT.test(v))) continue
        if (family.when === "focus" && !variants.some((v) => v.startsWith("focus"))) continue
        if (family.when === "descendant" && !variants.some((v) => DESCENDANT_VARIANT.test(v))) continue
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
  /**
   * Dosyada aynı adlı birden çok etiket varken istisnayı birine bağlar:
   * açılış etiketi metninin değişmez bir parçası (`aria-label="Çek"`).
   */
  match?: string
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
    file: "components/layout/global-search-box.tsx",
    tag: "Input",
    allow: ["styles.input"],
    reason:
      "Genel arama paletinin başlık girdisi: paletin kendi 53px başlık bandında kenarlıksız, dolgusuz satır (design-pattern-esantral §6, #712 ölçümü). Kutu değil, paletin parçası.",
  },
  // — Düğmeler (#889) —
  {
    file: "components/layout/global-search-box.tsx",
    tag: "Button",
    match: 'role="option"',
    allow: ["styles.option", "styles.selected"],
    reason:
      "Genel arama paletinin sonuç satırı (role=option): paletin #712 ölçümlü liste satırı — 36px, ikon kutusu, klavyeyle seçili satır --palette-hover. Başlık girdisiyle aynı paletin parçası (design-pattern-esantral §6).",
  },
  {
    file: "components/layout/app-shell.tsx",
    tag: "Button",
    match: 'aria-label="Genel arama"',
    allow: ["shellStyles.search"],
    reason:
      "Kenar çubuğu arama tetikleyicisi iOS dolgulu arama çubuğu görünümündedir (gri dolgu, kenarlıksız, 10px köşe; design-pattern-esantral §6). Düğme değil, paleti açan arama alanı taklidi.",
  },
  {
    file: "components/auth/login-form.tsx",
    tag: "Button",
    match: "aria-pressed={showPassword}",
    allow: ["formStyles.passwordToggle"],
    reason:
      "Giriş formu pazarlama kitinin FloatingField'ıyla kurulur; şifre göster/gizle metin düğmesi o alanın içindeki --mk-* ölçeğindeki parçadır (dialog-form.module.css, design-pattern-esantral §7).",
  },
  // — Dilim 2 (#928): ton variant'ı olmayan üç kalıp + bir veri çubuğu —
  {
    file: "components/layout/impersonation-banner.tsx",
    tag: "Button",
    match: 'type="submit"',
    allow: ["bg-warning-foreground/10", "hover:bg-warning-foreground/20"],
    reason:
      "Taklit modu bandı düz bg-warning zemin üzerinde durur; düğme koyu warning-foreground'un tonlu yüzeyidir (zemine göre ters tonlama). warning-tint açık zemin içindir ve bu bantta okunmaz; tek kullanım, variant açmaya değmez.",
  },
  {
    file: "components/intake/photo-delete-button.tsx",
    tag: "Button",
    match: 'aria-label={photoLabel',
    allow: ["text-destructive-strong", "hover:bg-destructive"],
    reason:
      "Fotoğraf küçük resminin üstündeki sil dairesi: dinlenirken opak nötr daire, hover'da DOLU kırmızı zemin + destructive-foreground ikon (ters kontrast). destructive-ghost tonlu /10 hover verir; dolu kırmızı hover bu kalıba özgü ve tek kullanım.",
  },
  {
    file: "components/orders/parts-labor-grid.tsx",
    tag: "Button",
    match: "void cancel()",
    allow: ["text-destructive-strong"],
    reason:
      "Metin içindeki 'Siparişi iptal et' satır içi bağlantısı: link variant'ı birincil mavidir, yıkıcı eylem kırmızı okunmalı. destructive-ghost hover zemini ve odak kenarlığı taşır, satır içi metne uymaz; tek kullanım.",
  },
  {
    file: "components/intake/fuel-gauge.tsx",
    tag: "ToggleGroupItem",
    match: "isFuelSegmentFilled",
    allow: ["bg-destructive", "data-[state=on]:bg-destructive"],
    reason:
      "Yakıt çubuğunun dolu bölmeleri bir veri göstergesidir (düşük seviyede kırmızı dolgu, normalde birincil dolgu); düğme tonu değil. Seçili durumu ezen data-[state=on]: kuralı gerekli (yorum yerinde).",
  },
  {
    file: "components/shared/photo-lightbox.tsx",
    tag: "Button",
    match: "aria-current",
    allow: ["rounded-md", "p-0"],
    reason:
      "Tam ekran fotoğraf görüntüleyicinin küçük resim şeridi: görselin kendisi düğmedir (matris Kurallar — görüntüleyicinin kendi kontrolleri kapsam dışı).",
  },
  {
    file: "components/shared/camera-scanner.tsx",
    tag: "Button",
    match: 'aria-label="Çek"',
    allow: ["size-16", "rounded-full", "border-white"],
    reason:
      "Tam ekran kamera katmanının deklanşörü: 64px halkalı daire (kamera uygulaması kalıbı), kontrol matrisi dışında. Zemin/metin on-photo variant'ından; halka on-photo'nun soluk çerçevesi değil, kalın düz beyaz (border-4 border-white) kalır (#925).",
  },
  {
    file: "components/shared/camera-scanner.tsx",
    tag: "Button",
    match: "flex-col gap-1 rounded-xl",
    allow: ["h-auto", "rounded-xl", "py-2", "text-xs"],
    reason:
      "Tam ekran kamera katmanında deklanşörün iki yanındaki ikon-üstü-etiket kontrolleri (El ile gir / Dosyadan): kamera uygulaması kalıbı, kontrol matrisi dışında.",
  },
  {
    file: "components/intake/registration-scanner.tsx",
    tag: "Button",
    match: 'aria-label="Çek"',
    allow: ["size-16", "rounded-full", "border-white"],
    reason:
      "Tam ekran ruhsat tarayıcısının deklanşörü: 64px halkalı daire (kamera uygulaması kalıbı), kontrol matrisi dışında. Zemin/metin on-photo variant'ından; halka kalın düz beyaz (border-4 border-white) kalır (#925).",
  },
]

/** İstisna bu etikete uygulanır mı (`match` verilmişse etiket metninde aranır). */
const exceptionCovers = (e: Exception, row: Pick<Row, "file" | "tag" | "text">) =>
  e.file === row.file && e.tag === row.tag && (!e.match || row.text.includes(e.match))

const SRC = fileURLToPath(new URL("../../", import.meta.url))
const OUT_OF_SCOPE = [
  // Kontrollerin kendisi: ölçüyü burada tanımlar.
  `components${sep}ui${sep}`,
  // Pazarlama yüzeyi kendi --mk-* ölçeğini taşır.
  `components${sep}marketing${sep}`,
]
/**
 * `components/sections/` VARSAYILAN olarak kapsamdadır (#1000): yeni bir bölüm
 * dosyası matrise uymak zorunda doğar; `h-*`/`rounded-*` ezmesi kapıyı düşürür.
 * Bir bölüm gerçekten `--mk-*` pazarlama ölçeğini taşıyorsa buraya DOSYA
 * adıyla ve GEREKÇESİYLE eklenir — klasör toptan dışarıda bırakılmaz.
 */
const SECTION_EXCEPTIONS: Record<string, string> = {}
const SECTIONS_DIR = `components${sep}sections${sep}`

/** `rel`: `src/`ye göre yol. `sections/` varsayılan kapsamdadır, yalnız gerekçeli istisna dışarıda. */
function isOutOfScope(rel: string): boolean {
  if (rel.startsWith(SECTIONS_DIR)) return rel.split(sep).join("/") in SECTION_EXCEPTIONS
  return OUT_OF_SCOPE.some((dir) => `${rel}${sep}`.startsWith(dir))
}

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
    (path) => isOutOfScope(relative(SRC, path))
  )
  scanned = { controls, rawInputs }
  return scanned
}

type Row = { file: string; tag: string; line: number; text: string; hits: string[] }

function callSiteViolations(): Row[] {
  return scan().controls.flatMap((tag) => {
    const hits = violations(tag)
    return hits.length ? [{ file: tag.file, tag: tag.name, line: tag.line, text: tag.text, hits }] : []
  })
}

/** `"h-7 (yükseklik)"` → `"h-7"` */
const hitClass = (hit: string) => hit.slice(0, hit.lastIndexOf(" ("))

describe("form kontrolleri, düğmeler ve akordeon çağrı yerinde ezilmez (#888, #889, #926)", () => {
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

  test("düğme kuralı ölçü/köşe/yazı ezmesini yakalar, yerleşim ve durum rengine dokunmaz (#889)", () => {
    const bad = [
      '<Button size="sm" className="h-7 text-xs">',
      `<Button variant="ghost" size="icon" className="${"size-" + "11"} ${"lg:" + "size-8"}">`,
      '<Button onClick={() => go()} className={cn("h-auto w-full rounded-xl p-4", open && "bg-muted")}>',
      '<Button className="rounded-full">',
      '<Button className="font-normal">',
      `<Button className="${"print:" + "h-36"}">`,
      `<InputGroupButton size="icon-sm" className="${"size-" + "11"}">`,
      '<Button className="min-h-7 justify-start">',
      '<Button className="focus-visible:ring-0">',
      '<Button variant="ghost" className="dark:bg-transparent">',
      '<Button variant="outline" className="border-transparent shadow-none">',
      '<Button className={styles.cta}>',
      // className'i Button'a ileten sarmalayıcı da aynı kuralla taranır.
      '<PrintButton className="h-8" />',
      // `*ClassName` prop'u da içteki kontrole gider.
      '<FilterSheet triggerClassName="h-7" />',
      // Öğenin kendisini seçen keyfi varyant sayılır (torun seçicisi değil).
      `<Button className="${"[&]:" + "h-7"}">`,
      `<Button className="${"[&:not(:disabled)]:" + "rounded-lg"}">`,
      // Kırılım / kap önekli nötr yüzey ezmesi de yüzey ezmesidir.
      `<Button variant="ghost" className="${"max-md:" + "bg-transparent"}">`,
      `<Button className="${"@xl:" + "bg-muted"}">`,
      `<Button className="${"min-[400px]:" + "shadow-none"}">`,
      // Yarı saydam nötr yüzey.
      `<Button variant="outline" className="${"bg-background/" + "95"}">`,
      // Seçiciler aynı kural setiyle taranır.
      `<ToggleGroupItem className="${"h-auto rounded-lg " + "py-2"}">`,
      '<ToggleGroup className="rounded-lg bg-muted p-0.5">',
      // Sekmeler de aynı kural setiyle taranır (#854).
      '<TabsTrigger value="a" className="h-7 rounded-lg">',
      '<TabsTrigger value="a" className="mb-1 text-xs">',
      '<TabsList variant="line" className="h-auto bg-transparent p-0">',
      '<TabsList variant="line" className="w-full border-b pb-0">',
    ]
    for (const source of bad) {
      const tags = jsxOpeningTags(`import styles from "./x.module.css"\n${source}`, CONTROLS)
      expect(tags.length).toBeGreaterThan(0)
      expect(violations(tags[0])).not.toEqual([])
    }

    const good = [
      '<Button className="w-full justify-between gap-2 text-left whitespace-normal md:hidden">',
      `<Button size="icon" className="${"[&_svg:not([class*='size-'])]:" + "size-5"}">`,
      `<Button className="relative before:absolute ${"before:" + "h-11"} ${"before:" + "min-h-full"}">`,
      '<Button variant="ghost" className="text-muted-foreground hover:bg-muted disabled:hover:bg-transparent">',
      '<Button className="shadow-md">',
      '<Button size="row" className="w-full items-start border-dashed px-4 font-mono">',
      '<Button variant="outline" size="row" className="h-full hover:ring-2 hover:ring-primary">',
      `<Button size="icon" className="${"[&>svg]:" + "size-5"} ${"*:" + "size-4"}">`,
      '<ToggleGroup variant="outline" size="control" className="grid w-full gap-2 sm:grid-cols-2">',
      '<ToggleGroupItem className="w-full justify-start text-muted-foreground">',
      '<TabsList variant="line" size="control" className="flex w-full flex-nowrap justify-start gap-1 border-b border-border -mb-px overflow-x-auto">',
      '<TabsList size="control" className="grid w-full grid-cols-2 sm:w-fit">',
      '<TabsTrigger value="a" className="shrink-0">',
    ]
    for (const source of good) {
      for (const tag of jsxOpeningTags(source, CONTROLS)) expect(violations(tag)).toEqual([])
    }
  })

  test("düğme tonu variant'tan gelir: yıkıcı çerçeve, birincil ton, fotoğraf üstü (#925)", () => {
    const bad = [
      '<Button variant="outline" className="border-destructive/20 text-destructive-strong">',
      `<Button variant="outline" className="${"border-" + "destructive"}">`,
      '<Button variant="secondary" className="bg-primary/10 text-primary-strong">',
      `<Button variant="outline" className="${"dark:" + "bg-primary/20"}">`,
      '<Button variant="ghost" size="icon" className="bg-white/10 text-white">',
      '<Button variant="outline" className="border-white/30 text-white">',
      // Fotoğraf üstü ton durum önekinde de yasak: variant="on-photo-ghost".
      '<Button variant="ghost" className="text-white hover:bg-white/15">',
      `<Button variant="ghost" className="${"bg-" + "black/60"}">`,
      // Tarih seçici className'i tetikleyici Button'a iletir.
      `<DatePicker className="${"h-" + "8"}" />`,
      '<DateRangePicker className="bg-transparent" />',
      '<DateTimePicker className="font-normal" />',
    ]
    for (const source of bad) {
      const tags = jsxOpeningTags(source, CONTROLS)
      expect(tags.length).toBeGreaterThan(0)
      expect(violations(tags[0])).not.toEqual([])
    }

    const good = [
      '<Button variant="destructive-outline" className="w-full gap-2">',
      '<Button variant="destructive-ghost" size="icon-sm" className="text-muted-foreground">',
      '<Button variant="outline" className="hover:bg-primary/10 hover:ring-2 hover:ring-primary">',
      '<Button variant="tint" size="row" className="ring-2 ring-primary">',
      '<Button variant="on-photo" size="icon" aria-label="Kapat">',
      '<DateRangePicker className="w-64" />',
    ]
    for (const source of good) {
      for (const tag of jsxOpeningTags(source, CONTROLS)) expect(violations(tag)).toEqual([])
    }
  })

  test("düğme tonu dilim 2: yıkıcı, uyarı ve fotoğraf üstü ton variant'tan gelir (#928)", () => {
    const bad = [
      // Yıkıcı ton her önekte yasak: variant="destructive-ghost".
      '<Button variant="ghost" className="text-destructive-strong">',
      '<Button variant="ghost" className="hover:bg-destructive/10 hover:text-destructive-strong">',
      `<Button variant="ghost" className="${"dark:hover:bg-" + "destructive/20"}">`,
      // Uyarı tonu: variant="warning-tint".
      '<Button variant="outline" className="border-warning/40">',
      '<Button variant="outline" className="bg-warning/10">',
      `<Button variant="outline" className="${"hover:bg-" + "warning/20"}">`,
      // Birincil kenarlık tonu: variant="tint".
      '<Button variant="outline" className="border-primary/40">',
      // Galeri oku: variant="on-photo-scrim".
      `<CarouselPrevious className="${"bg-" + "black/60"} text-white" />`,
      '<CarouselNext className="bg-white/10" />',
    ]
    for (const source of bad) {
      const tags = jsxOpeningTags(source, CONTROLS)
      expect(tags.length).toBeGreaterThan(0)
      expect(violations(tags[0])).not.toEqual([])
    }

    const good = [
      '<Button variant="destructive-ghost" size="icon-sm" className="text-muted-foreground">',
      '<Button variant="destructive-outline" className="w-full">',
      '<Button variant="warning-tint" size="sm" className="touch-manipulation">',
      '<Button variant="tint" size="default">',
      '<CarouselPrevious size="icon" variant="on-photo-scrim" className="left-2" />',
      '<Button variant="outline" className="hover:bg-primary/10 text-warning-strong">',
    ]
    for (const source of good) {
      for (const tag of jsxOpeningTags(source, CONTROLS)) expect(violations(tag)).toEqual([])
    }
  })

  test("akordeon ölçü, dolgu, köşe ve zemini variant'tan alır; yerleşime dokunmaz (#926)", () => {
    const bad = [
      '<AccordionTrigger className="px-4 py-3 hover:no-underline">',
      '<AccordionItem className="rounded-xl border bg-card">',
      '<AccordionItem className="border-0">',
      '<AccordionContent className="px-4 pb-4">',
      `<AccordionTrigger className="${"min-h-" + "14"} ring-1 ring-foreground/10">`,
      // İkon gibi iç parçayı torun seçiciyle ezmek de ölçü ezmesidir.
      `<AccordionTrigger className="${"**:data-[slot=accordion-trigger-icon]:" + "size-5!"}">`,
      '<AccordionTrigger className="text-sm font-medium">',
      `<Accordion className="${"space-y-2 " + "rounded-lg"}">`,
      '<AccordionContent className={styles.x}>',
      // Torun seçicisi akordeonda atlanmaz: variant'ın dolgusu, iç parçası,
      // bağlantı alt çizgisi ve düzyazı aralığı torundan da ezilmez.
      `<Accordion className="${"[&_button]:" + "py-5"}">`,
      `<AccordionItem className="${"[&_[data-slot=accordion-trigger]]:" + "py-5"}">`,
      `<AccordionContent className="${"[&_a]:" + "no-underline"}">`,
      `<AccordionContent className="${"[&_p]:" + "mb-0"}">`,
    ]
    for (const source of bad) {
      const tags = jsxOpeningTags(`import styles from "./x.module.css"\n${source}`, CONTROLS)
      expect(tags.length).toBeGreaterThan(0)
      expect(violations(tags[0])).not.toEqual([])
    }

    // Her aile tek sınıfla ayrı ayrı sabitlenir: sınıf tam olarak o aileye düşer.
    const single: [string, string, string][] = [
      ["AccordionItem", "bg-card", "zemin"],
      ["AccordionTrigger", "hover:no-underline", "alt çizgi → variant"],
      ["AccordionItem", "ring-1", "halka kalınlığı"],
      ["AccordionItem", "ring-2", "halka kalınlığı"],
      ["AccordionItem", "ring" + "-inset", "halka kalınlığı"],
      ["AccordionTrigger", "ring-offset-2", "halka boşluğu"],
      ["AccordionTrigger", "outline-none", "outline"],
      ["AccordionItem", "border-b-0", "kenarlık kaldırma"],
      ["AccordionTrigger", "h-10", "yükseklik"],
      ["AccordionTrigger", "h-auto", "yükseklik"],
      ["AccordionItem", "shadow-sm", "gölge"],
    ]
    for (const [tag, cls, family] of single) {
      const [scanned] = jsxOpeningTags(`<${tag} className="${cls}">`, CONTROLS)
      expect(violations(scanned)).toEqual([`${cls} (${family})`])
    }

    const good = [
      '<AccordionTrigger className="items-center gap-3 text-muted-foreground hover:text-foreground">',
      '<AccordionItem className="border-t border-border">',
      '<AccordionItem className={cn("scroll-mt-4 transition-colors", isNew && "border-warning/30 bg-primary/[0.04]")}>',
      '<AccordionContent className="grid gap-2 leading-relaxed sm:grid-cols-2">',
      '<Accordion variant="card" className="mt-4 w-full">',
      // Durum rengi ve hücreyi dolduran yükseklik serbest; halka RENGİ durum tonudur.
      '<AccordionTrigger className="hover:bg-muted/50 h-full">',
      '<AccordionItem className="ring-warning/30">',
      '<AccordionItem className={cn(done ? "ring-success/30" : "ring-primary/25")}>',
      `<AccordionItem className="${"ring-[color:var(--" + "warning)]"}">`,
      // Tetikleyici içindeki öğe kendi etiketidir; akordeon kuralı ona uygulanmaz.
      '<AccordionTrigger className="gap-3"><span className="line-clamp-1 text-xs" /></AccordionTrigger>',
    ]
    for (const source of good) {
      for (const tag of jsxOpeningTags(source, CONTROLS)) expect(violations(tag)).toEqual([])
    }
  })

  test("açılır bölüm animasyon, taşma, yükseklik ve gizlemeyi primitive'e bırakır (#950)", () => {
    const bad = [
      '<CollapsibleContent className="overflow-hidden">',
      `<CollapsibleContent className="${"animate-" + "collapsible-down"}">`,
      `<CollapsibleContent className="${"h-" + "40"}">`,
      `<CollapsibleContent className="${"max-h-" + "40"}">`,
      '<CollapsibleContent className="hidden">',
      `<CollapsibleContent className="${"data-[state=closed]:" + "hidden"}">`,
      '<Collapsible className="overflow-visible">',
    ]
    for (const source of bad) {
      const tags = jsxOpeningTags(source, CONTROLS)
      expect(tags.length).toBeGreaterThan(0)
      expect(violations(tags[0])).not.toEqual([])
    }

    const good = [
      '<Collapsible className="mt-3 border-t border-border pt-2">',
      '<CollapsibleContent className="flex flex-wrap items-center gap-2 border-t bg-muted/40 px-3 py-2">',
      '<CollapsibleContent keepMounted className="pt-3">',
      '<CollapsibleTrigger asChild><Button className="w-full justify-between" /></CollapsibleTrigger>',
    ]
    for (const source of good) {
      for (const tag of jsxOpeningTags(source, CONTROLS)) expect(violations(tag)).toEqual([])
    }
  })

  test("her CollapsibleTrigger asChild ile sarar ve kendi className'ini taşımaz (#950)", () => {
    const triggers = scan().controls.filter((tag) => tag.name === "CollapsibleTrigger")
    expect(triggers.length).toBeGreaterThan(0)
    const offenders = triggers
      .filter((tag) => !tag.attributes.has("asChild") || tag.attributes.has("className"))
      .map((tag) => `${tag.file}:${tag.line}`)
    expect(offenders).toEqual([])
  })

  test("form kontrolü ve düğme çağrı yerlerinde ölçü ezmesi yok", () => {
    const offenders = callSiteViolations().flatMap((row) => {
      const allowed = new Set(
        EXCEPTIONS.filter((e) => exceptionCovers(e, row)).flatMap((e) => e.allow)
      )
      const hits = row.hits.filter((hit) => !allowed.has(hitClass(hit)))
      return hits.length ? [`${row.file}:${row.line} <${row.tag}> ${hits.join(", ")}`] : []
    })
    expect(offenders).toEqual([])
  })

  test("yeni bir sections/ dosyası varsayılan kapsamda doğar; h-*/rounded-* ezmesi düşer (#1000)", () => {
    const fresh = `components${sep}sections${sep}YeniBolum.tsx`
    expect(isOutOfScope(fresh)).toBe(false)
    expect(isOutOfScope(`components${sep}ui${sep}button.tsx`)).toBe(true)
    for (const reason of Object.values(SECTION_EXCEPTIONS)) expect(reason.length).toBeGreaterThan(20)
    const bad = ['<Button className="h-12 px-6">', '<Input className="rounded-full" />']
    for (const source of bad) {
      const tags = jsxOpeningTags(source, CONTROLS)
      expect(tags.length).toBeGreaterThan(0)
      expect(violations(tags[0])).not.toEqual([])
    }
  })

  test("istisna listesinde bayat ya da gerekçesiz satır yok", () => {
    const rows = callSiteViolations()
    const stale = EXCEPTIONS.filter(
      (e) =>
        !e.allow.every((cls) =>
          rows.some((row) => exceptionCovers(e, row) && row.hits.some((hit) => hitClass(hit) === cls))
        )
    ).map((e) => `${e.file} <${e.tag}>${e.match ? ` [${e.match}]` : ""} ${e.allow.join(" ")}`)
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
