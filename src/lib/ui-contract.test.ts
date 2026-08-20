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
