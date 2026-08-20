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
 * Autocomplete, SidebarMenuButton — BAK-155) hâlâ geçerli, `FormField` ise
 * react-hook-form'un kendi render prop'u ve LİSTEYE GİRMEZ.
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
