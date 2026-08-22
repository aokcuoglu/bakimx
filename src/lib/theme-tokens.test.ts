import { expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

/**
 * Tailwind, tanımlı OLMAYAN bir renk token'ı için sessizce HİÇ kural üretmez.
 * Yani `text-destructive-foreground` gibi bir sınıf, token yoksa görünürde
 * doğru dururken hiçbir şey yapmaz — TypeScript de lint de yakalamaz. Gerçek
 * bir hata bu şekilde çıktı: dolu kırmızı zemin üzerindeki sil ikonu, foreground
 * token'ı olmadığı için kırmızı kalıp kayboluyordu (PR #241).
 *
 * Bu tarama, kaynakta kullanılan her `<utility>-<x>-foreground` sınıfı için
 * `globals.css`'teki `@theme` bloğunda `--color-<x>-foreground` tanımı arar.
 */

const ROOT = join(import.meta.dir, "..")
const SRC = join(ROOT, "..", "src")

/** `@theme` içinde tanımlı renk anahtarları (`--color-*`). */
function definedColorTokens(): Set<string> {
  const css = readFileSync(join(SRC, "app", "globals.css"), "utf8")
  const tokens = new Set<string>()
  for (const m of css.matchAll(/--color-([a-z0-9-]+)\s*:/g)) tokens.add(m[1])
  return tokens
}

/** Bir tema bloğundaki (`:root` / `.dark`) ham renk değişkenleri. */
function themeBlock(which: "root" | "dark"): Record<string, string> {
  const css = readFileSync(join(SRC, "app", "globals.css"), "utf8")
  const re = which === "root" ? /:root\s*\{([\s\S]*?)\n\}/ : /\.dark\s*\{([\s\S]*?)\n\}/
  const body = css.match(re)?.[1] ?? ""
  const vars: Record<string, string> = {}
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*(oklch\([^)]*\)|#[0-9a-fA-F]{3,8})\s*;/g)) {
    vars[m[1]] = m[2]
  }
  return vars
}

/**
 * `@theme` bloğunda DOĞRUDAN sabit değerle tanımlı renkler (`--color-navy`,
 * `--color-brand`, `--color-whatsapp`). Bunlar `:root`/`.dark` içinde yok —
 * temadan bağımsız marka renkleri. `var(--x)` yönlendirmeleri atlanır.
 */
function literalThemeColors(): Record<string, string> {
  const css = readFileSync(join(SRC, "app", "globals.css"), "utf8")
  const vars: Record<string, string> = {}
  for (const m of css.matchAll(/--color-([a-z0-9-]+):\s*(oklch\([^)]*\)|#[0-9a-fA-F]{3,8})\s*;/g)) {
    vars[m[1]] = m[2]
  }
  return vars
}

/** oklch() / hex → sRGB [0-1]. */
function toRgb(value: string): [number, number, number] {
  if (value.startsWith("#")) {
    const h = value.slice(1)
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number]
  }
  const [L, C, H = 0] = value.match(/[-\d.]+/g)!.map(Number)
  const hr = (H * Math.PI) / 180
  const a = C * Math.cos(hr)
  const b = C * Math.sin(hr)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const enc = (v: number) => {
    const c = Math.max(0, Math.min(1, v))
    return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
  }
  return [
    enc(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    enc(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    enc(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ]
}

/** İki sRGB rengi alfa ile karıştırır (`bg-<renk>/10` gibi tonlu zeminler için). */
function mixSrgb(base: [number, number, number], over: [number, number, number], alpha: number): [number, number, number] {
  return base.map((v, i) => v * (1 - alpha) + over[i] * alpha) as [number, number, number]
}

function relLum(rgb: [number, number, number]): number {
  const f = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
  return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2])
}

function contrastRgb(a: [number, number, number], b: [number, number, number]): number {
  const x = relLum(a)
  const y = relLum(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

function contrast(bg: string, fg: string): number {
  const lum = (c: string) => {
    const f = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
    const [r, g, b] = toRgb(c)
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const a = lum(bg)
  const b = lum(fg)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** Kaynakta geçen `-foreground` / `-strong` renk sınıfları → kullanılan token adı. */
const CLASS_RE =
  /\b(?:text|bg|border|ring|fill|stroke|from|via|to|decoration|outline|shadow|accent|caret|divide)-([a-z0-9-]*(?:foreground|strong))\b/g

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(tsx?|css)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full)
  }
  return out
}

test("globals.css destructive-foreground token'ını tanımlar", () => {
  expect(definedColorTokens().has("destructive-foreground")).toBe(true)
})

/**
 * Her `<renk>` / `<renk>-foreground` çifti, üstünde küçük metin taşıyabildiği
 * için WCAG AA (4.5:1) eşiğini geçmeli. `success` açık temada 3.47:1 ile
 * kalıyordu — yeşil zeminli butonun yazısı zor okunuyordu.
 */
test("tema renk/foreground çiftleri WCAG AA (4.5:1) geçer", () => {
  const failures: string[] = []

  for (const which of ["root", "dark"] as const) {
    const vars = themeBlock(which)
    for (const [name, bg] of Object.entries(vars)) {
      if (name.endsWith("-foreground")) continue
      const fg = vars[`${name}-foreground`]
      if (!fg) continue
      const ratio = contrast(bg, fg)
      if (ratio < 4.5) {
        const tema = which === "root" ? "açık" : "koyu"
        failures.push(`${tema}/${name}: ${ratio.toFixed(2)}:1 (bg ${bg}, fg ${fg})`)
      }
    }
  }

  expect(failures).toEqual([])
})

/**
 * Yukarıdaki test yalnız `:root` / `.dark` bloklarını gezer; `@theme` içinde
 * DOĞRUDAN sabit değerle duran marka renkleri (navy, whatsapp) o taramanın
 * dışında kalıyordu — `--color-whatsapp` / `--color-whatsapp-foreground` çifti
 * bu yüzden yıllarca sessizce AA altında durabildi (BAK-160). Bu test o boşluğu
 * kapatır: marka çiftleri de ölçülür, istisna ancak GEREKÇESİYLE yazılır.
 */
type BrandPairException = {
  /** `<x>` — `--color-<x>` / `--color-<x>-foreground` çiftinin adı. */
  token: string
  /** Ölçülen oran; kayıt düşülür ki "farkında değildik" denemesin. */
  measured: string
  /** Neden bilinçli — kanıtsız istisna yazma. */
  reason: string
}

const BRAND_PAIR_EXCEPTIONS: BrandPairException[] = [
  {
    token: "whatsapp",
    measured: "1.98:1",
    reason:
      "WhatsApp'ın kurumsal buton yeşili (#25D366) üzerinde beyaz metin. " +
      "Sahip kararı (alpkaan, 2026-08-20, BAK-160): paylaş butonu WhatsApp'ın " +
      "kendi görünümünü taşısın; marka tanınırlığı AA eşiğinin önünde. " +
      "Yalnız WhatsApp paylaş yüzeyinde kullanılır, uygulama içi metin taşımaz.",
  },
]

test("marka renk/foreground çiftleri WCAG AA (4.5:1) geçer", () => {
  const brand = literalThemeColors()
  const failures: string[] = []
  const usedExceptions = new Set<string>()

  for (const [name, bg] of Object.entries(brand)) {
    if (name.endsWith("-foreground")) continue
    const fg = brand[`${name}-foreground`]
    if (!fg) continue
    const exception = BRAND_PAIR_EXCEPTIONS.find((e) => e.token === name)
    if (exception) {
      usedExceptions.add(name)
      continue
    }
    const ratio = contrast(bg, fg)
    if (ratio < 4.5) {
      failures.push(
        `${name}: ${ratio.toFixed(2)}:1 (bg ${bg}, fg ${fg})` +
          ` — tonu koyulaştır ya da gerekçesiyle BRAND_PAIR_EXCEPTIONS'a ekle`
      )
    }
  }

  expect(failures).toEqual([])

  // Ölü istisna, allowlist'in gerçeği yansıtmadığı anlamına gelir.
  const stale = BRAND_PAIR_EXCEPTIONS.filter((e) => !usedExceptions.has(e.token)).map((e) => e.token)
  expect(stale).toEqual([])
})

test("kullanılan her -foreground sınıfının temada karşılığı var", () => {
  const defined = definedColorTokens()
  const offenders: string[] = []

  for (const file of walk(SRC)) {
    const rel = file.slice(SRC.length + 1)
    const source = readFileSync(file, "utf8")
    source.split("\n").forEach((line, i) => {
      // `--color-foo-foreground: var(--foo-foreground)` tanımının kendisi kullanım değil.
      if (line.trimStart().startsWith("--color-")) return
      for (const m of line.matchAll(CLASS_RE)) {
        const token = m[1]
        if (!defined.has(token)) offenders.push(`${rel}:${i + 1} → ${m[0]} (--color-${token} tanımsız)`)
      }
    })
  }

  expect(offenders).toEqual([])
})

/**
 * Fill renkleri (`--success` vb.) canlı olmak zorunda — warning kehribar
 * kalmalı, yoksa kahverengiye döner. Ama aynı canlı ton AÇIK yüzeyde METİN
 * olarak AA'yı geçmiyordu. `-strong` tonları tam bu iş için var: hem kart
 * zemininde hem de `bg-<renk>/10` tonlu zeminde okunaklı olmalılar.
 */
test("-strong tonları açık yüzeyde ve tonlu zeminde AA geçer", () => {
  const failures: string[] = []

  for (const which of ["root", "dark"] as const) {
    const vars = themeBlock(which)
    const card = vars.card
    for (const name of ["success", "warning", "destructive", "primary", "item-labor", "item-external"]) {
      const strong = vars[`${name}-strong`]
      const fill = vars[name]
      if (!strong || !fill || !card) {
        failures.push(`${which}/${name}: token eksik`)
        continue
      }
      // `bg-<renk>/10` kartın üstünde: %10 fill + %90 kart
      const tint = mixSrgb(toRgb(card), toRgb(fill), 0.1)
      const onCard = contrastRgb(toRgb(card), toRgb(strong))
      const onTint = contrastRgb(tint, toRgb(strong))
      const tema = which === "root" ? "açık" : "koyu"
      if (onCard < 4.5) failures.push(`${tema}/${name}-strong kart üzerinde ${onCard.toFixed(2)}:1`)
      if (onTint < 4.5) failures.push(`${tema}/${name}-strong tonlu zeminde ${onTint.toFixed(2)}:1`)
    }
  }

  expect(failures).toEqual([])
})

/**
 * `text-success` / `text-warning` / `text-destructive` FILL tonunu kullanır; o
 * ton canlı olmak zorunda olduğu için açık yüzeyde metin olarak AA'yı geçmez.
 * Metin ve ikon için `-strong` tonu var. Çıplak kullanım geri sızmasın diye
 * kaynak taraması yapılıyor (Tailwind sınıfı geçerli olduğundan derleyici
 * yakalayamaz).
 */
test("metin için çıplak text-<renk> yerine -strong kullanılır", () => {
  const bare = /\btext-(success|warning|destructive|item-labor|item-external)(?![-\w])/
  const offenders: string[] = []

  for (const file of walk(SRC)) {
    const rel = file.slice(SRC.length + 1)
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      if (bare.test(line)) offenders.push(`${rel}:${i + 1} → ${line.trim().slice(0, 90)}`)
    })
  }

  expect(offenders).toEqual([])
})

/**
 * `text-primary` diğer üçünden farklı: dolgu tonu (`--primary`) AÇIK YÜZEYDE
 * metin olarak AA'yı geçiyor (kartta 5.20:1), yani link rengi olarak meşru.
 * Düştüğü tek yer TONLU ZEMİN: `bg-primary/10` üstünde kartta 4.51:1 ile
 * kılpayı geçip sayfa zemininde 4.27:1'e, `bg-muted` panelde 4.05:1'e iniyor
 * (BAK-160). Bu yüzden tarama çıplak `text-primary`nin tamamını değil, yalnız
 * `bg-primary/10` ile aynı satırda duranını yakalar — orada `-strong` şart.
 */
test("tonlu primary zemininde metin -strong tonunu kullanır", () => {
  const bare = /\btext-primary(?![-/\w])/
  const offenders: string[] = []

  for (const file of walk(SRC)) {
    const rel = file.slice(SRC.length + 1)
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      if (line.includes("bg-primary/10") && bare.test(line)) {
        offenders.push(`${rel}:${i + 1} → ${line.trim().slice(0, 90)}`)
      }
    })
  }

  expect(offenders).toEqual([])
})

/**
 * `muted-foreground` ikincil metin rolüdür ve DÜZ yüzeylerde AA'yı rahat geçer
 * (kart 6.00:1, sayfa 5.66:1, `bg-muted` panel 5.34:1). Düştüğü yer TONLU
 * zemin — ve düşme sebebi uygulamanın kendi kabuğu: içerik alanı
 * (`SidebarInset`) `bg-background` değil `bg-muted`. `bg-destructive/10` bir de
 * onun üstüne binince efektif zemin yeterince koyulaşıyor ve ikincil metin
 * 4.49:1'e iniyor — /cashbox/aging'in 11px KPI etiketi tarayıcıda 4.43:1
 * ölçüldü (BAK-189). Diğer rollerdeki desenin aynısı: metin için ayrı bir
 * `-strong` tonu.
 */
test("muted-foreground-strong tonlu zeminde de AA geçer", () => {
  const failures: string[] = []

  for (const which of ["root", "dark"] as const) {
    const vars = themeBlock(which)
    const strong = vars["muted-foreground-strong"]
    const tema = which === "root" ? "açık" : "koyu"
    if (!strong) {
      failures.push(`${tema}: --muted-foreground-strong tanımlı değil`)
      continue
    }
    for (const surfaceName of ["card", "background", "muted"]) {
      const surface = toRgb(vars[surfaceName])
      const grounds: [string, [number, number, number]][] = [[surfaceName, surface]]
      for (const fill of ["success", "warning", "destructive", "primary"]) {
        grounds.push([`${fill}/10 · ${surfaceName}`, mixSrgb(surface, toRgb(vars[fill]), 0.1)])
      }
      for (const [name, ground] of grounds) {
        const ratio = contrastRgb(ground, toRgb(strong))
        if (ratio < 4.5) failures.push(`${tema}/muted-foreground-strong ${name} üzerinde ${ratio.toFixed(2)}:1`)
      }
    }
  }

  expect(failures).toEqual([])
})

/**
 * Kullanım tarafı. Yukarıdaki `text-primary` taramasından iki farkı var:
 *
 * 1. Tonlu zemin ile metin AYNI STRING LİTERALİNDE aranır. Bu ekranlarda tint
 *    çoğunlukla bir üçlü operatörün bir dalında, `text-muted-foreground` ise
 *    ÖTEKİ dalındadır (`vehicle-detail.tsx:568` ve altı) — ikisi hiçbir zaman
 *    aynı anda uygulanmaz, satır bazlı tarama yedi yanlış pozitif üretirdi.
 * 2. Tint'in ÖNÜNDE varyant olmamalı: `hover:bg-destructive/10` ya da
 *    `data-[state=on]:bg-primary/10` durağan zemin değildir; durağan renk zaten
 *    `text-muted-foreground` ve o düz yüzeyde geçiyor.
 *
 * Ebeveyn/çocuk hâlini (tint kapsayıcıda, metin içeride) bu tarama GÖREMEZ —
 * /cashbox/aging'de tam olarak öyleydi. Orada çözüm tonu satıra taşımaktı:
 * `bucketColors` tablosunda `label` alanı `bg` ile yan yana durur, böylece
 * eşleşme bu taramaya görünür hale gelir. Yeni bir tonlu kart yazarken aynısını
 * yap; kapı ancak o zaman işe yarar.
 */
test("tonlu zeminde ikincil metin muted-foreground-strong kullanır", () => {
  const bareMuted = /\btext-muted-foreground(?![-/\w])/
  const unprefixedTint = /(?<![\w:-])bg-(?:success|warning|destructive|primary)\/10\b/
  const offenders: string[] = []

  for (const file of walk(SRC)) {
    const rel = file.slice(SRC.length + 1)
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      for (const literal of line.match(/"[^"]*"/g) ?? []) {
        if (unprefixedTint.test(literal) && bareMuted.test(literal)) {
          offenders.push(`${rel}:${i + 1} → ${literal.slice(0, 90)}`)
        }
      }
    })
  }

  expect(offenders).toEqual([])
})

/* ------------------------------------------------------------------------- *
 * Opaklık modifier'lı METİN sınıfları (BAK-156)
 *
 * Palet dondurulmuş ve token'lar doğru; borç KULLANIM tarafındaydı. Bir
 * `text-<token>` sınıfına `/70` eklendiğinde renk zemine doğru soluyor ve
 * kontrast sessizce düşüyor — Tailwind geçerli bir sınıf ürettiği için ne
 * TypeScript ne lint görüyor, yukarıdaki testler de opaklığı yalnız tonlu
 * ZEMİN (`bg-<renk>/10`) için hesaplıyordu. Bu yüzden 425 kullanım birikti;
 * `text-muted-foreground/70` tek başına 224 yerdeydi ve açık temada 3.02:1
 * ile AA'nın (4.5:1) epey altındaydı.
 *
 * Bu tarama her `text-<token>/<opaklık>` kullanımını bulur, rengi zemine alfa
 * ile kompoze eder ve ölçülen kontrastı eşiğe vurur. Yüzey tahmini:
 *   - `<x>-foreground` ve `<x>` bir dolgu token'ıysa → yüzey `<x>`
 *     (`navy-foreground` → navy, `sidebar-foreground` → sidebar).
 *   - `foreground` / `muted-foreground` ve dolgu token'ları → uygulamanın tüm
 *     genel yüzeyleri; hepsinde geçmek zorunda.
 * Bilinçli istisnalar aşağıdaki allowlist'te GEREKÇESİYLE durur.
 * ------------------------------------------------------------------------- */

/** Bir sınıfın nerede kullanılabileceği bilinmiyorsa varsayılan yüzey kümesi. */
const APP_SURFACES = ["background", "card", "popover", "muted", "secondary", "accent"]

const AA_TEXT = 4.5

type OpacityException = {
  /** `src` köküne göre dosya yolu. */
  file: string
  /** Tam sınıf adı, ör. `text-muted-foreground/50`. */
  className: string
  /** Neden bilinçli — kanıtsız istisna yazma. */
  reason: string
  /** Ölçüm bu yüzeye karşı yapılsın (bileşen zemini sabitse). */
  surface?: string
  /**
   * Salt dekoratif: anlamı komşu metin taşıyor, işaret kaldırılsa bilgi
   * kaybolmuyor. Ölçüm atlanır (WCAG 1.4.3 dekoratif istisnası).
   */
  decorative?: true
}

/**
 * Boş-durum illüstrasyonu: her zaman hemen altındaki açıklama metniyle
 * birlikte görünür, tek başına bilgi taşımaz. Kaldırılsa ekran anlamını
 * korur — bu yüzden soluk ton bilinçli (WCAG 1.4.3 dekoratif istisnası).
 */
const EMPTY_STATE_ICON = "Boş-durum illüstrasyon ikonu; anlamı yanındaki metin taşıyor."
/** `bg-muted` küçük karenin içindeki görsel yer tutucusu — gerçek görsel yoksa. */
const IMAGE_PLACEHOLDER = "Görsel yer tutucu ikonu; ürünün adı/metni yanında tam kontrastta."
/** Metin parçalarını ayıran nokta. Ekran okuyucuya bir şey söylemiyor. */
const SEPARATOR_DOT = "Ayraç noktası; kaldırılsa bilgi kaybı yok."

const OPACITY_EXCEPTIONS: OpacityException[] = [
  // --- Alert: zemini sabit `bg-card`, açıklama metni başlıktan bir ton açık.
  { file: "components/ui/alert.tsx", className: "text-destructive-strong/90", surface: "card", reason: "Alert zemini her varyantta bg-card; açıklama başlıktan bir ton açık." },
  { file: "components/ui/alert.tsx", className: "text-success-strong/90", surface: "card", reason: "Alert zemini her varyantta bg-card; açıklama başlıktan bir ton açık." },
  { file: "components/ui/alert.tsx", className: "text-warning-strong/90", surface: "card", reason: "Alert zemini her varyantta bg-card; açıklama başlıktan bir ton açık." },

  // --- Dekoratif grafikler
  { file: "components/damage/vehicle-damage-map.tsx", className: "text-border/40", decorative: true, reason: "Araç şemasının panel çizgileri; hasar işaretleri tam kontrastta ayrı katmanda." },
  { file: "components/shared/brand-spinner.tsx", className: "text-brand/70", decorative: true, reason: "aria-hidden çark grafiği; durumu sr-only 'Yükleniyor' metni bildiriyor." },

  // --- Ayraçlar
  { file: "components/intake/public-share-page.tsx", className: "text-muted-foreground/40", decorative: true, reason: SEPARATOR_DOT },
  { file: "components/vehicles/public-vehicle-passport.tsx", className: "text-muted-foreground/40", decorative: true, reason: SEPARATOR_DOT },
  { file: "components/orders/detail-header.tsx", className: "text-muted-foreground/40", decorative: true, reason: SEPARATOR_DOT },
  { file: "components/orders/parts-labor-grid.tsx", className: "text-muted-foreground/40", decorative: true, reason: `${SEPARATOR_DOT} Ayrıca boş-durum ikonları.` },

  // --- Görsel yer tutucuları
  { file: "components/parts/part-number-match-alert.tsx", className: "text-muted-foreground/50", decorative: true, reason: IMAGE_PLACEHOLDER },
  { file: "components/parts/part-search-input.tsx", className: "text-muted-foreground/50", decorative: true, reason: IMAGE_PLACEHOLDER },
  { file: "components/parts/tecdoc-article-row.tsx", className: "text-muted-foreground/50", decorative: true, reason: IMAGE_PLACEHOLDER },
  { file: "components/technician/parts-request-section.tsx", className: "text-muted-foreground/50", decorative: true, reason: IMAGE_PLACEHOLDER },
  { file: "components/vehicles/vehicle-detail.tsx", className: "text-muted-foreground/50", decorative: true, reason: `${IMAGE_PLACEHOLDER} Ayrıca boş-durum ikonları.` },
  { file: "components/vehicles/vehicle-passport.tsx", className: "text-muted-foreground/50", decorative: true, reason: `${IMAGE_PLACEHOLDER} Ayrıca boş-durum ikonları.` },
  { file: "components/vehicles/vehicle-photo-history.tsx", className: "text-muted-foreground/50", decorative: true, reason: IMAGE_PLACEHOLDER },
  { file: "components/intake/grouped-photo-gallery.tsx", className: "text-muted-foreground/30", decorative: true, reason: IMAGE_PLACEHOLDER },
  { file: "components/intake/photo-gallery-grid.tsx", className: "text-muted-foreground/30", decorative: true, reason: IMAGE_PLACEHOLDER },

  // --- Boş-durum illüstrasyonları
  { file: "app/(app)/appointments/page.tsx", className: "text-muted-foreground/50", decorative: true, reason: EMPTY_STATE_ICON },
  { file: "app/(app)/bakimx-orders/page.tsx", className: "text-muted-foreground/50", decorative: true, reason: EMPTY_STATE_ICON },
  { file: "app/(app)/cashbox/page.tsx", className: "text-muted-foreground/50", decorative: true, reason: EMPTY_STATE_ICON },
  { file: "app/(app)/cashbox/payments/page.tsx", className: "text-muted-foreground/50", decorative: true, reason: EMPTY_STATE_ICON },
  { file: "app/(app)/customers/balances/page.tsx", className: "text-muted-foreground/50", decorative: true, reason: EMPTY_STATE_ICON },
  { file: "app/(app)/orders/page.tsx", className: "text-muted-foreground/50", decorative: true, reason: EMPTY_STATE_ICON },
  { file: "app/(app)/purchases/page.tsx", className: "text-muted-foreground/50", decorative: true, reason: EMPTY_STATE_ICON },
  { file: "app/(app)/quotes/page.tsx", className: "text-muted-foreground/50", decorative: true, reason: EMPTY_STATE_ICON },
  { file: "components/appointments/calendar-view.tsx", className: "text-muted-foreground/50", decorative: true, reason: EMPTY_STATE_ICON },
  { file: "components/auth/register-form.tsx", className: "text-muted-foreground/50", decorative: true, reason: EMPTY_STATE_ICON },
  { file: "components/cashbox/collection-create-form.tsx", className: "text-muted-foreground/50", decorative: true, reason: EMPTY_STATE_ICON },
  { file: "components/customers/customer-detail.tsx", className: "text-muted-foreground/50", decorative: true, reason: EMPTY_STATE_ICON },
  { file: "components/dashboard/reminder-widget.tsx", className: "text-muted-foreground/50", decorative: true, reason: EMPTY_STATE_ICON },
  { file: "components/labor/labor-list.tsx", className: "text-muted-foreground/50", decorative: true, reason: EMPTY_STATE_ICON },
  { file: "components/orders/order-management-panel.tsx", className: "text-muted-foreground/50", decorative: true, reason: EMPTY_STATE_ICON },
  { file: "components/orders/technician-assign.tsx", className: "text-muted-foreground/40", decorative: true, reason: EMPTY_STATE_ICON },
  { file: "components/orders/parts-labor-grid.tsx", className: "text-muted-foreground/40", decorative: true, reason: EMPTY_STATE_ICON },
  { file: "components/parts/part-detail.tsx", className: "text-muted-foreground/50", decorative: true, reason: EMPTY_STATE_ICON },
  { file: "components/parts/part-detail-dialog.tsx", className: "text-muted-foreground/40", decorative: true, reason: EMPTY_STATE_ICON },
  { file: "components/parts/part-supplier-prices-field.tsx", className: "text-muted-foreground/50", decorative: true, reason: EMPTY_STATE_ICON },
  { file: "components/parts/parts-list.tsx", className: "text-muted-foreground/50", decorative: true, reason: EMPTY_STATE_ICON },
  { file: "components/parts/tecdoc-search-results.tsx", className: "text-muted-foreground/50", decorative: true, reason: EMPTY_STATE_ICON },
  { file: "components/reminders/reminder-list.tsx", className: "text-muted-foreground/50", decorative: true, reason: EMPTY_STATE_ICON },
  { file: "components/settings/technician-management.tsx", className: "text-muted-foreground/50", decorative: true, reason: EMPTY_STATE_ICON },
  { file: "components/shared/empty-state.tsx", className: "text-muted-foreground/50", decorative: true, reason: EMPTY_STATE_ICON },
  { file: "components/suppliers/supplier-detail.tsx", className: "text-muted-foreground/50", decorative: true, reason: EMPTY_STATE_ICON },
  { file: "components/suppliers/suppliers-list.tsx", className: "text-muted-foreground/50", decorative: true, reason: EMPTY_STATE_ICON },
]

/** `<x>-foreground` → dolgu token'ı `<x>`; genel metin renkleri için null. */
function pairedSurface(token: string, vars: Record<string, string>): string | null {
  if (token === "foreground" || token === "muted-foreground") return null
  const base = token.replace(/-foreground$/, "")
  if (base === token) return null
  return vars[base] ? base : null
}

test("opaklık modifier'lı metin sınıfları AA (4.5:1) geçer", () => {
  const OPACITY_CLASS_RE = /\btext-([a-z][a-z0-9-]*)\/([0-9]{1,3})\b/g
  const failures: string[] = []
  const usedExceptions = new Set<string>()

  // Tema bloğu (`:root` / `.dark`) her zaman kazanır; `@theme inline` sabitleri
  // (navy, brand, whatsapp) yalnız temada karşılığı olmayanları doldurur.
  const themes = {
    root: { ...literalThemeColors(), ...themeBlock("root") },
    dark: { ...literalThemeColors(), ...themeBlock("dark") },
  }

  for (const file of walk(SRC)) {
    const rel = file.slice(SRC.length + 1)
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      if (line.trimStart().startsWith("--color-")) return
      for (const m of line.matchAll(OPACITY_CLASS_RE)) {
        const [full, token, alphaStr] = m
        const alpha = Number(alphaStr) / 100
        const exception = OPACITY_EXCEPTIONS.find((e) => e.file === rel && e.className === full)
        if (exception) {
          usedExceptions.add(`${exception.file}|${exception.className}`)
          if (exception.decorative) continue
        }

        for (const which of ["root", "dark"] as const) {
          const vars = themes[which]
          const fgRaw = vars[token]
          if (!fgRaw) {
            failures.push(`${rel}:${i + 1} → ${full} (--${token} tanımsız)`)
            break
          }
          const surfaces = exception?.surface
            ? [exception.surface]
            : (pairedSurface(token, vars) ? [pairedSurface(token, vars)!] : APP_SURFACES)
          const fg = toRgb(fgRaw)
          for (const surface of surfaces) {
            const bgRaw = vars[surface]
            if (!bgRaw) continue
            const bg = toRgb(bgRaw)
            const ratio = contrastRgb(bg, mixSrgb(bg, fg, alpha))
            if (ratio < AA_TEXT) {
              const tema = which === "root" ? "açık" : "koyu"
              failures.push(
                `${rel}:${i + 1} → ${full} ${tema} temada ${surface} zemininde ${ratio.toFixed(2)}:1` +
                  ` (opaklığı kaldır ya da gerekçesiyle OPACITY_EXCEPTIONS'a ekle)`
              )
            }
          }
        }
      }
    })
  }

  expect(failures).toEqual([])

  // Ölü istisna, allowlist'in gerçeği yansıtmadığı anlamına gelir.
  const stale = OPACITY_EXCEPTIONS.filter((e) => !usedExceptions.has(`${e.file}|${e.className}`))
    .map((e) => `${e.file} → ${e.className}`)
  expect(stale).toEqual([])
})

/* ------------------------------------------------------------------------- *
 * Tek başına `opacity-*` utility'si (BAK-160)
 *
 * BAK-156'nın kapısı `text-<token>/<opaklık>` yazımını tarıyor. Aynı işi yapan
 * ikinci bir yazım var ve o kapıya görünmüyordu: elemana `opacity-80` vermek
 * metni de aynı oranda soldurur. İki etikette (müşteri detayı, hatırlatma
 * KPI'ları) tam olarak bu vardı.
 *
 * Bu tarama ölçüm YAPAMAZ — `opacity-80` bir renk adı taşımıyor, soldurulan
 * ton çağrı yerinden miras alınıyor. Yani "hangi renk ne kadar düştü" statik
 * olarak bilinemez; kural bu yüzden ölçüm değil, gerekçe ister: kaldır ya da
 * neden güvenli olduğunu yaz.
 *
 * Sınırlar — bilinçli ve dar tutuldu, "her şey kapsandı" sanılmasın:
 *   - Yalnız ÖN EKSİZ `opacity-*` sayılır. `hover:` / `disabled:` / `md:` gibi
 *     bir varyantın arkasındakiler durum stilidir, durağan metni soldurmaz.
 *   - `opacity-0` ve `opacity-100` atlanır: biri öğeyi tamamen gizler (kontrast
 *     sorusu değil), diğeri zaten tam opak.
 *
 * KAPSAM GENİŞLEMESİ (BAK-167): ilk yazımda yalnız aynı satırda bir `text-*`
 * utility'si olan satırlara bakılıyordu, yani öğenin metin biçimlendirdiği
 * kesinse. O yazımın kaçırdığı sınıf yorumda "sıradaki iş" diye duruyordu ve
 * gerçekten de dışarıda kalmıştı: metni TAŞIYAN kapsayıcıya konan opaklık.
 * Üç somut örnek çıktı — plaka rozeti (`<PlateBadge className="opacity-60">`,
 * altı çağrı yeri, "TR" şeridi 2.71:1) ve pasif üye/teknisyen kartları
 * (`bg-muted opacity-60`, metin 2.44:1). Kapı artık ÖN EKSİZ her `opacity-*`
 * kullanımını ister; `text-*` şartı kalktı.
 *
 * Ölçüm hâlâ yapılamıyor (opaklık renk adı taşımaz, soldurulan ton çağrı
 * yerinden miras alınır), yani kural yine gerekçe ister: kaldır ya da neden
 * güvenli olduğunu — ölçebiliyorsan ölçüsüyle — allowlist'e yaz.
 * ------------------------------------------------------------------------- */

type OpacityUtilityException = {
  /** `src` köküne göre dosya yolu. */
  file: string
  /** Tam sınıf adı, ör. `opacity-80`. */
  className: string
  /** Neden bilinçli — kanıtsız istisna yazma. */
  reason: string
}

const OPACITY_UTILITY_EXCEPTIONS: OpacityUtilityException[] = [
  {
    file: "components/ui/calendar.tsx",
    className: "opacity-50",
    reason:
      "Takvimde DEVRE DIŞI gün hücresi. WCAG 1.4.3 etkisiz (disabled) bileşenleri " +
      "kontrast şartından açıkça muaf tutar; depodaki `disabled:opacity-50` deseniyle aynı.",
  },
  {
    file: "components/parts/part-detail-dialog.tsx",
    className: "opacity-80",
    reason:
      "Dolu `bg-foreground/70` zemininde duran büyüteç ikonu; hover'da tam opaklığa " +
      "çıkıyor ve anlamı görselin kendisi taşıyor — metin değil.",
  },

  // --- Metin taşımayan ikonlar (BAK-167 kapsam genişlemesiyle taramaya girdi)
  {
    file: "components/ui/date-picker.tsx",
    className: "opacity-60",
    reason:
      "Tetikleyicinin sağındaki takvim ikonu; seçili tarih metni aynı düğmede tam " +
      "opaklıkta ve alan `FormLabel` ile etiketli — ikon kaldırılsa bilgi kaybı yok.",
  },
  {
    file: "components/ui/date-time-picker.tsx",
    className: "opacity-60",
    reason: "date-picker.tsx ile aynı tetikleyici deseni; takvim ikonu, metin tam opaklıkta.",
  },
  {
    file: "components/intake/grouped-photo-gallery.tsx",
    className: "opacity-20",
    reason: EMPTY_STATE_ICON,
  },
  {
    file: "components/intake/approval-timeline.tsx",
    className: "opacity-30",
    reason: EMPTY_STATE_ICON,
  },
  {
    file: "components/orders/order-activity-log.tsx",
    className: "opacity-30",
    reason: EMPTY_STATE_ICON,
  },

  // --- Etkisiz (disabled/pending) durumlar — WCAG 1.4.3 muafiyeti
  {
    file: "components/technician/technician-dashboard.tsx",
    className: "opacity-60",
    reason:
      "`isPending` sırasında `pointer-events-none` ile birlikte veriliyor; sunucu " +
      "eylemi dönene kadar süren geçici etkisiz durum, durağan metin değil.",
  },

  // --- İkon ve görsel: soldurulan şey metin değil
  {
    file: "components/ui/combobox.tsx",
    className: "opacity-50",
    reason:
      "Çipin ✕ kaldırma düğmesi; içinde metin yok (yalnız `XIcon`), silinecek etiket " +
      "aynı çipte tam opaklıkta duruyor ve hover'da tam opaklığa çıkıyor.",
  },
  {
    file: "components/sections/PartnersStrip.tsx",
    className: "opacity-60",
    reason:
      "Landing iş ortağı logoları — `grayscale` ile birlikte verilen bilinçli monokrom " +
      "işlem, hover'da tam renge dönüyor. Soldurulan şey `<Image>`, metin değil; " +
      "ortak adı `alt` metninde tam olarak duruyor.",
  },

  // --- Ölçülebilen ve geçen tek durak
  {
    file: "components/layout/app-shell.tsx",
    className: "opacity-60",
    reason:
      "Kenar çubuğunda 'yakında' menü öğesi; opaklık bu öğenin TEK ayırt edici " +
      "işareti (rozet yok), kaldırılsa bilgi kaybolur. Ölçüldü: sidebar zemininde " +
      "`sidebar-foreground` %60'ta 7.14:1 — AA'nın epey üstünde.",
  },
]

test("tek başına opacity-* durağan öğede kullanılmaz", () => {
  const OPACITY_UTILITY_RE = /(?<![\w:.-])opacity-(\d{1,3})\b/g
  const failures: string[] = []
  const usedExceptions = new Set<string>()

  for (const file of walk(SRC)) {
    const rel = file.slice(SRC.length + 1)
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      for (const m of line.matchAll(OPACITY_UTILITY_RE)) {
        const value = Number(m[1])
        if (value === 0 || value >= 100) continue
        const exception = OPACITY_UTILITY_EXCEPTIONS.find((e) => e.file === rel && e.className === m[0])
        if (exception) {
          usedExceptions.add(`${exception.file}|${exception.className}`)
          continue
        }
        failures.push(
          `${rel}:${i + 1} → ${m[0]} durağan öğede` +
            ` (kaldır ya da gerekçesiyle OPACITY_UTILITY_EXCEPTIONS'a ekle)`
        )
      }
    })
  }

  expect(failures).toEqual([])

  // Ölü istisna, allowlist'in gerçeği yansıtmadığı anlamına gelir.
  const stale = OPACITY_UTILITY_EXCEPTIONS.filter((e) => !usedExceptions.has(`${e.file}|${e.className}`))
    .map((e) => `${e.file} → ${e.className}`)
  expect(stale).toEqual([])
})
