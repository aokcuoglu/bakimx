import { expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const SRC = join(import.meta.dir, "..")
const SCOPES = [
  join(SRC, "app", "admin"),
  join(SRC, "app", "(app)", "analytics"),
  join(SRC, "app", "(app)", "reports"),
  join(SRC, "app", "(app)", "settings"),
  join(SRC, "components", "settings"),
]

const SHELL_FILES = [
  join(SRC, "components", "layout", "app-shell.tsx"),
  join(SRC, "components", "ui", "sidebar.tsx"),
]

function tsxFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) tsxFiles(path, files)
    else if (entry.endsWith(".tsx")) files.push(path)
  }
  return files
}

test("yönetim yüzeylerinde görünür ham interaktif kontrol yok", () => {
  const offenders: string[] = []
  for (const file of [...SCOPES.flatMap((scope) => tsxFiles(scope)), ...SHELL_FILES]) {
    const source = readFileSync(file, "utf8").replace(/<input\b[^>]*type=["']hidden["'][^>]*\/>/gs, "")
    source.split("\n").forEach((line, index) => {
      if (/<(?:button|input|select|textarea)\b/.test(line)) {
        offenders.push(`${relative(SRC, file)}:${index + 1}`)
      }
    })
  }
  expect(offenders).toEqual([])
})

test("yönetim yüzeylerinde sabit durum rengi yok", () => {
  const fixedStatusColor = /\b(?:text|bg|border)-(?:red|green|yellow|amber|orange|emerald|rose|blue)-\d{2,3}\b/
  const offenders: string[] = []
  for (const file of SCOPES.flatMap((scope) => tsxFiles(scope))) {
    readFileSync(file, "utf8").split("\n").forEach((line, index) => {
      if (fixedStatusColor.test(line)) offenders.push(`${relative(SRC, file)}:${index + 1}`)
    })
  }
  expect(offenders).toEqual([])
})

/**
 * Aynı kural, yüzeyden bağımsız olarak TÜM `src` için (BAK-167 → BAK-178).
 *
 * Yukarıdaki tarama yalnız dört yönetim yüzeyini (`admin`, `analytics`,
 * `reports`, `settings`) gezdiği için `/parts` ekranının rozet renkleri
 * `src/lib/parts/status.ts` içinde ham palette yazılı kalmıştı; "Pasif" rozeti
 * 2.51:1, "Stokta Yok" 4.35:1 ölçüldü ve iki kapının ikisi de görmedi — biri
 * yüzey listesinde yok, diğeri `.tsx` dışına bakmıyordu. BAK-167'de kapı
 * `src/lib` ile sınırlı açıldı; bileşen ağacındaki 10 dosya / 24 satırlık borç
 * BAK-178'de temizlendi ve kapsam artık tüm `src`.
 *
 * NOT: bu yorumda sınıf adlarını tam yazmıyoruz. Tailwind içerik tarayıcısı
 * test dosyalarını da geziyor, yani yorumdaki bir renk sınıfı dizgisi üretilen
 * CSS'e ölü bir kural olarak giriyor — ölçtük, iki kural ekliyordu.
 *
 * Bir renk sınıfı kaynakta geçiyorsa tema token'ı kullanmak zorundadır; koyu
 * tema, kontrast kapıları ve olası bir palet değişimi ancak o zaman geçerli
 * olur. Kategori rengi gibi token karşılığı olmayan bir ihtiyaç çıkarsa çözüm
 * allowlist değil YENİ TOKEN — `--item-labor` / `--item-external` (BAK-178)
 * bunun örneği.
 *
 * Tarama yalnız numaralı palet tonlarını (`-50` … `-950`) yakalar. `white` /
 * `black` bilinçli olarak kapsam dışı: bunları kullanan tek yer plaka rozeti
 * ve o gerçekten beyaz zeminde siyah metindir, tema değişkeni değil.
 */
const RAW_PALETTE_EXCEPTIONS: { file: string; line: number; reason: string }[] = [
  // macOS pencere düğmelerinin birebir taklidi: kırmızı/sarı/yeşil daireler bir
  // durum göstermiyor, tarayıcı çerçevesinin kendisini çiziyorlar (landing
  // sayfası ürün görseli). Token'a bağlamak resmi bozar, dekoratif oldukları
  // için kontrast şartı da yok.
  { file: "components/sections/DeviceFrame.tsx", line: 5, reason: "macOS pencere düğmesi taklidi (dekoratif)" },
  { file: "components/sections/DeviceFrame.tsx", line: 6, reason: "macOS pencere düğmesi taklidi (dekoratif)" },
  { file: "components/sections/DeviceFrame.tsx", line: 7, reason: "macOS pencere düğmesi taklidi (dekoratif)" },
]

test("src içinde ham palet rengi yok", () => {
  const RAW_PALETTE =
    /\b(?:text|bg|border|ring|fill|stroke|from|via|to|divide|decoration|outline|shadow|placeholder|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/
  const offenders: string[] = []
  const usedExceptions = new Set<string>()
  const files: string[] = []
  const collect = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry.startsWith(".")) continue
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) collect(path)
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) files.push(path)
    }
  }
  collect(SRC)
  for (const file of files) {
    const rel = relative(SRC, file)
    readFileSync(file, "utf8").split("\n").forEach((line, index) => {
      const hit = line.match(RAW_PALETTE)
      if (!hit) return
      const lineNo = index + 1
      const exception = RAW_PALETTE_EXCEPTIONS.find((e) => e.file === rel && e.line === lineNo)
      if (exception) {
        usedExceptions.add(`${rel}:${lineNo}`)
        return
      }
      offenders.push(`${rel}:${lineNo} → ${hit[0]} (tema token'ı kullan ya da gerekçesiyle RAW_PALETTE_EXCEPTIONS'a ekle)`)
    })
  }
  expect(offenders).toEqual([])

  // Ölü istisna bırakma: satır kaydığında ya da kullanım silindiğinde muafiyet
  // sessizce başka bir ihlali örtmesin.
  const stale = RAW_PALETTE_EXCEPTIONS.filter((e) => !usedExceptions.has(`${e.file}:${e.line}`)).map(
    (e) => `${e.file}:${e.line}`
  )
  expect(stale).toEqual([])
})

/**
 * Aynı borcun ikinci yazımı: palet adı yerine köşeli parantezli sabit renk
 * (`bg-[#...]`). Üstteki tarama bunu görmüyor çünkü ortada palet adı yok.
 * BAK-178'de bulunan tek örnek plaka tarayıcısının TR şeridiydi — aynı şeridi
 * çizen `PlateBadge` bileşeni token kullanırken tarayıcı sabit hex'e sapmıştı,
 * yani iki yüzey aynı rengi iki farklı kaynaktan alıyordu.
 *
 * `--color-whatsapp` gibi bir marka rengi gerekiyorsa yeri burası değil:
 * `globals.css` içindeki `@theme` bloğunda token olarak tanımlanır ve
 * `theme-tokens.test.ts` kontrastını ölçer.
 */
test("src içinde köşeli parantezli sabit renk yok", () => {
  const ARBITRARY_COLOR = /-\[#[0-9a-fA-F]{3,8}\]/
  const offenders: string[] = []
  const files: string[] = []
  const collect = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry.startsWith(".")) continue
      const path = join(dir, entry)
      if (statSync(path).isDirectory()) collect(path)
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) files.push(path)
    }
  }
  collect(SRC)
  for (const file of files) {
    readFileSync(file, "utf8").split("\n").forEach((line, index) => {
      const hit = line.match(ARBITRARY_COLOR)
      if (hit) {
        offenders.push(
          `${relative(SRC, file)}:${index + 1} → ${hit[0]} (globals.css'te token tanımla ve onu kullan)`
        )
      }
    })
  }
  expect(offenders).toEqual([])
})

/**
 * Button/Badge (BAK-152), overlay ailesi (BAK-153) ve form ailesi (BAK-154)
 * Radix hattına geçti: kompozisyon `asChild` ile yapılır. Base UI'ye özgü
 * `render` / `nativeButton` prop'ları artık tip hatası vermez — Radix'in prop
 * tipleri bilinmeyen prop'u sessizce yutar ve DOM'a düşer (React da `render`
 * için uyarı basmaz). Kapı bu yüzden testte duruyor.
 *
 * Kapsam bilerek dar: `render` henüz göç etmemiş ailelerde (Combobox,
 * Autocomplete) hâlâ geçerli, `FormField` ise react-hook-form'un kendi render
 * prop'u ve LİSTEYE GİRMEZ. Sidebar ailesi BAK-189'da Radix `Slot`'a geçti ve
 * listeye eklendi.
 */
const RADIX_TAGS = [
  "Button",
  "Badge",
  // overlay ailesi — tetikleyici/kapatıcı yüzeyleri (BAK-153)
  "DialogTrigger",
  "DialogClose",
  "AlertDialogTrigger",
  "AlertDialogAction",
  "AlertDialogCancel",
  "SheetTrigger",
  "SheetClose",
  "PopoverTrigger",
  "TooltipTrigger",
  "DropdownMenuTrigger",
  "DropdownMenuSubTrigger",
  // form ailesi (BAK-154)
  "SelectTrigger",
  "SelectValue",
  "SelectItem",
  "SelectIcon",
  "TabsTrigger",
  "AccordionTrigger",
  "Toggle",
  "ToggleGroupItem",
  "Checkbox",
  "Switch",
  "FormControl",
  "InputGroupButton",
  // sidebar ailesi (BAK-189)
  "SidebarGroupLabel",
  "SidebarGroupAction",
  "SidebarMenuButton",
  "SidebarMenuAction",
  "SidebarMenuSubButton",
]

/** Bir JSX açılış etiketinin gövdesini süslü parantez/dize farkındalığıyla çıkarır. */
function openingTags(source: string, tag: string): string[] {
  const out: string[] = []
  const re = new RegExp(`<${tag}(?![A-Za-z0-9_])`, "g")
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) {
    let i = m.index + m[0].length
    let depth = 0
    while (i < source.length) {
      const c = source[i]
      if (c === "{") depth++
      else if (c === "}") depth--
      else if (c === '"' || c === "'" || (depth > 0 && c === "`")) {
        const quote = c
        i++
        while (i < source.length && source[i] !== quote) {
          if (source[i] === "\\") i++
          i++
        }
      } else if (depth === 0 && c === ">") break
      i++
    }
    out.push(source.slice(m.index, i))
  }
  return out
}

test("Radix hattındaki bileşen çağrılarında Base UI render/nativeButton kalmadı", () => {
  const offenders: string[] = []
  for (const file of tsxFiles(SRC)) {
    const source = readFileSync(file, "utf8")
    if (!source.includes("nativeButton") && !source.includes("render")) continue
    for (const tag of RADIX_TAGS) {
      for (const open of openingTags(source, tag)) {
        if (!/(?<![A-Za-z0-9_])(render|nativeButton)\s*=/.test(open)) continue
        const line = source.slice(0, source.indexOf(open)).split("\n").length
        offenders.push(`${relative(SRC, file)}:${line} <${tag}>`)
      }
    }
  }
  expect(offenders).toEqual([])
})

/* ------------------------------------------------------------------------- *
 * `data-open:` / `data-checked:` — ÖLÜ DEĞİL, köprülü (BAK-189 düzeltmesi)
 *
 * BAK-189'un ilk teslimatı (PR #463) bu kısayolları "Base UI kalıntısı, Radix'te
 * hiç eşleşmiyor" diye 11 dosyada `data-[state=...]`e çevirdi ve aynı iddiayı
 * bir kapıya yazdı. İDDİA YANLIŞTI; tarayıcıda ölçüldü:
 *
 *   - Çeviri ÖNCESİ hâlde `Switch` zeminini değiştiriyor (gri → mavi),
 *     başparmak `calc(100% - 2px)` kayıyor, `Checkbox` işaretliyken doluyor,
 *     aktif sekmenin alt çizgisi `opacity: 1`, dialog `animation-name: enter`.
 *   - Sebebi `globals.css:10`un içeri aldığı `shadcn/tailwind.css`
 *     (`node_modules/shadcn/dist/tailwind.css:28-88`): bu adları
 *     `@custom-variant` olarak tanımlar ve HER BİRİ İKİ seçici üretir —
 *
 *       .data-checked\:bg-primary:where([data-state="checked"]),
 *       .data-checked\:bg-primary:where([data-checked]:not([data-checked="false"]))
 *
 * Yani kısayol, iki kütüphaneyi köprüleyen bilinçli bir shim. Çeviri zararsızdı
 * ama gereksizdi; asıl zarar KURALIN kendisiydi — çalışan bir yazımı yasaklayan
 * bir kapı, sonraki her okuru aynı yanlış teşhise götürür.
 *
 * Gerçek risk sınıfın kendisi değil, KÖPRÜNÜN KAYBOLMASI: `shadcn` paketi
 * güncellenip bu blok değişirse kısayolu kullanan her sınıf tek seferde ve
 * sessizce ölür. Kapı artık onu bekçiler.
 * ------------------------------------------------------------------------- */

/** Kısayol adı → Radix tarafında eşleşmesi ZORUNLU seçici parçası. */
const SHADCN_STATE_VARIANTS: Record<string, string> = {
  "data-open": '[data-state="open"]',
  "data-closed": '[data-state="closed"]',
  "data-checked": '[data-state="checked"]',
  "data-unchecked": '[data-state="unchecked"]',
  "data-active": '[data-state="active"]',
  "data-horizontal": '[data-orientation="horizontal"]',
  "data-vertical": '[data-orientation="vertical"]',
}

/** `@custom-variant <ad> { … }` bloğunun gövdesini çıkarır. */
function customVariantBody(css: string, name: string): string | null {
  const start = css.indexOf(`@custom-variant ${name} {`)
  if (start === -1) return null
  let depth = 0
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++
    else if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1)
  }
  return null
}

test("shadcn durum kısayolları Radix yazımına köprü kurmayı sürdürüyor", () => {
  const css = readFileSync(
    join(SRC, "..", "node_modules", "shadcn", "dist", "tailwind.css"),
    "utf8"
  )
  const failures: string[] = []

  for (const [variant, radixSelector] of Object.entries(SHADCN_STATE_VARIANTS)) {
    const body = customVariantBody(css, variant)
    if (!body) {
      failures.push(`@custom-variant ${variant} kayboldu — kısayolu kullanan her sınıf öldü`)
      continue
    }
    if (!body.includes(radixSelector)) {
      failures.push(`${variant} artık ${radixSelector} ile eşleşmiyor — Radix tarafı koptu`)
    }
  }

  expect(failures).toEqual([])
})

/**
 * Kısayolun TUTMADIĞI tek yer: Radix Tooltip durumu hiç `open` yazmaz,
 * `instant-open` ya da `delayed-open` yazar
 * (`@radix-ui/react-tooltip/dist/index.mjs:109`). `data-open:` bu yüzden
 * tooltip'te sessizce eşleşmez — hızlı ardışık hover'da (skipDelay penceresi)
 * ipucu animasyonsuz beliriyordu. İki durum da açıkça yazılmak zorunda.
 *
 * Aynı boşluk Radix'in kısayolu olmayan diğer durumları için de geçerli:
 * Toggle `on`/`off`, Checkbox `indeterminate`.
 */
test("tooltip giriş animasyonu iki açılış durumunu da açıkça yazar", () => {
  const source = readFileSync(join(SRC, "components", "ui", "tooltip.tsx"), "utf8")

  expect(source).toContain("data-[state=delayed-open]:animate-in")
  expect(source).toContain("data-[state=instant-open]:animate-in")
  // `data-open:` tooltip'te ölüdür — geri sızarsa yanlış güven verir. Yalnız
  // sınıf dizelerine bakılır; yorumda geçen ANLATIM bulgu değil.
  const inClassStrings = [...source.matchAll(/"([^"\n]*)"/g)]
    .map((m) => m[1])
    .filter((literal) => /(?<![\w[=-])data-open[:/]/.test(literal))
  expect(inClassStrings).toEqual([])
})

/**
 * Escape kapısı — Base UI (Combobox/Autocomplete) ile Radix overlay'lerinin
 * arasındaki iki sessiz veri kaybı yolu (BAK-190, tarayıcıda ölçüldü):
 *
 *  1. Base UI Escape'te yalnız listeyi kapatmıyor; Combobox'ta COMMIT EDİLMİŞ
 *     seçimi, Autocomplete'te liste kapalıyken serbest metni de siliyor.
 *  2. Radix `DismissableLayer` Escape'i document/capture'da dinlediği için
 *     (`@radix-ui/react-dismissable-layer/dist/index.mjs:105`) diyalog içindeki
 *     bir Base UI popup'ında tek Escape hem popup'ı hem diyaloğu kapatıyordu.
 *
 * Guard'lar 12 call-site'a dağıtılmıştı ve 6'sında hiç yoktu. Artık paylaşılan
 * bileşende duruyorlar; buradan düşerlerse hata sessizce geri gelir, hiçbir
 * derleyici uyarmaz.
 */
test("Base UI girişleri Escape'te değeri koruyor", () => {
  const combobox = readFileSync(join(SRC, "components", "ui", "combobox.tsx"), "utf8")
  const autocomplete = readFileSync(join(SRC, "components", "ui", "autocomplete.tsx"), "utf8")

  // Combobox: her iki giriş de (düz + chip'li) ortak guard'a bağlı olmalı.
  expect(combobox).toContain("function keepSelectionOnEscape(")
  expect(combobox.match(/onKeyDown=\{keepSelectionOnEscape\(onKeyDown\)\}/g)).toHaveLength(2)

  // Autocomplete: serbest metin yalnız liste KAPALIYKEN korunur; liste açıkken
  // Escape'in listeyi kapatma davranışı kalmalı.
  expect(autocomplete).toContain("event.preventBaseUIHandler()")
  expect(autocomplete).toContain('aria-expanded") !== "true"')
})

test("Radix overlay'leri ilk Escape'i açık Base UI popup'ına bırakıyor", () => {
  const helper = readFileSync(join(SRC, "components", "ui", "base-ui-popup.ts"), "utf8")
  // Radix'in tek kaçış kapısı `preventDefault`; `stopPropagation` işe yaramaz
  // (olay capture fazında Radix'e zaten ulaşmıştır). Yorumda geçen ANLATIM bulgu
  // değil — yalnız kodda çağrılması yanlış.
  const code = helper.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")
  expect(code).toContain("event.preventDefault()")
  expect(code).not.toContain("stopPropagation")

  for (const file of ["dialog.tsx", "sheet.tsx", "alert-dialog.tsx"]) {
    const source = readFileSync(join(SRC, "components", "ui", file), "utf8")
    expect(source).toContain("onEscapeKeyDown={(event) => yieldEscapeToBaseUIPopup(event, onEscapeKeyDown)}")
  }
})

/**
 * Guard artık paylaşılan bileşende; call-site'a geri kopyalanması iki yazımın
 * ayrışmasına ve "burada var, şurada yok" borcuna dönüyordu. Item `onClick`
 * içindeki kullanım ayrı bir şey (seçim commit'i), o serbest.
 */
test("Escape guard'ı call-site'lara geri sızmadı", () => {
  const offenders: string[] = []
  for (const file of tsxFiles(join(SRC, "components"))) {
    const rel = relative(SRC, file)
    if (rel.startsWith("components/ui/")) continue
    readFileSync(file, "utf8").split("\n").forEach((line, index) => {
      if (/preventBaseUIHandler/.test(line) && /Escape/.test(line)) {
        offenders.push(`${rel}:${index + 1}`)
      }
    })
  }
  expect(offenders).toEqual([])
})
