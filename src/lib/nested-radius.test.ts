import { expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import ts from "typescript"

// İç içe köşe kapısı (#898): kart/panel/popover (12-14px) içindeki bir iç kutu
// aynı köşeyi taşırsa iç içe iki kutu "aynı yarıçap" gibi görünür. İç kutu bir
// kademe küçük olmalı: `rounded-md`, onun içindeki `rounded-sm`.
// Sınır: yalnız AYNI dosyadaki sözcüksel iç içelik taranır — bileşen sınırını
// (başka dosyadaki Card içine render edilen bir bileşeni) göremez.
// Kural: docs/ui-control-sizing.md → "İç içe köşe".

const SRC = join(import.meta.dir, "..")

const SCANNED_DIRS = ["orders", "dashboard", "customers", "vehicles"].flatMap((name) => [
  join(SRC, "components", name),
  join(SRC, "app", "(app)", name),
])

// `dosya: gerekçe` — bilinçli istisna. Gerekçesiz ekleme yapma.
const ALLOWLIST: Record<string, string> = {
  "components/vehicles/public-vehicle-passport.tsx":
    "Herkese açık sayfa dilimine ertelendi (#898 dilim 2); ayrı yüzey, kendi değerlendirmesi",
}

const CONTAINER_TAGS = new Set([
  "Card",
  "CardContent",
  "CardHeader",
  "CardFooter",
  "PopoverContent",
  "DropdownMenuContent",
  "SelectContent",
  "DetailPanel",
])
const RESET_TAGS = new Set(["DialogContent", "AlertDialogContent", "SheetContent"])

const OFFENDER = /(?<![:\w-])rounded(?:-[trbl]{1,2})?-(?:lg|xl)(?![\w-])/
const CONTAINER_CLASS = /(?<![:\w-])rounded-(?:lg|xl|\(--radius-panel\))(?![\w-])/

function tsxFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) tsxFiles(path, files)
    else if (entry.endsWith(".tsx")) files.push(path)
  }
  return files
}

function classText(attributes: ts.JsxAttributes): string {
  const parts: string[] = []
  for (const attribute of attributes.properties) {
    if (!ts.isJsxAttribute(attribute) || attribute.name.getText() !== "className") continue
    const visit = (node: ts.Node) => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) parts.push(node.text)
      else if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) parts.push(node.text)
      ts.forEachChild(node, visit)
    }
    if (attribute.initializer) visit(attribute.initializer)
  }
  return parts.join(" ")
}

export function findNestedRadiusOffenders(source: string, fileName = "x.tsx"): number[] {
  const parsed = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const lines: number[] = []
  let depth = 0 // açık 12-14px kap sayısı (diyalog kabuğunda sıfırlanır)

  const check = (opening: ts.JsxOpeningElement | ts.JsxSelfClosingElement) => {
    if (depth > 0 && OFFENDER.test(classText(opening.attributes))) {
      lines.push(parsed.getLineAndCharacterOfPosition(opening.getStart(parsed)).line + 1)
    }
  }
  const isContainer = (opening: ts.JsxOpeningElement | ts.JsxSelfClosingElement) =>
    CONTAINER_TAGS.has(opening.tagName.getText(parsed)) || CONTAINER_CLASS.test(classText(opening.attributes))

  const visit = (node: ts.Node) => {
    if (ts.isJsxElement(node)) {
      const opening = node.openingElement
      check(opening)
      const saved = depth
      if (RESET_TAGS.has(opening.tagName.getText(parsed))) depth = 0
      else if (isContainer(opening)) depth += 1
      for (const child of node.children) visit(child)
      // Öznitelikler içindeki JSX (render prop vb.) da taransın
      opening.attributes.properties.forEach(visit)
      depth = saved
      return
    }
    if (ts.isJsxSelfClosingElement(node)) {
      check(node)
      node.attributes.properties.forEach(visit)
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(parsed)
  return lines
}

test("kapla aynı köşeyi taşıyan iç kutu yok (iç köşe her zaman dıştan küçük)", () => {
  const offenders: string[] = []
  for (const dir of SCANNED_DIRS) {
    for (const file of tsxFiles(dir)) {
      const path = relative(SRC, file)
      if (path in ALLOWLIST) continue
      for (const line of findNestedRadiusOffenders(readFileSync(file, "utf8"), file)) {
        offenders.push(
          `${path}:${line} — iç kutu kapla aynı köşede — \`rounded-md\` kullan (docs/ui-control-sizing.md → İç içe köşe)`
        )
      }
    }
  }
  expect(offenders).toEqual([])
})

test("kapı yapay bir ihlali yakalar, doğru iç köşeyi ve bağımsız kutuyu bırakır", () => {
  const bad = `export const A = () => (
  <Card>
    <div className="rounded-lg border p-3" />
  </Card>
)`
  expect(findNestedRadiusOffenders(bad)).toEqual([3])

  const nestedBox = `export const B = () => (
  <div className={cn("rounded-lg border bg-card")}>
    <div className="rounded-xl bg-muted" />
  </div>
)`
  expect(findNestedRadiusOffenders(nestedBox)).toEqual([3])

  const ok = `export const C = () => (
  <Card>
    <div className="rounded-md border p-3"><div className="rounded-sm" /></div>
    <div className="size-8 rounded-full" />
  </Card>
)
export const D = () => <div className="rounded-lg border bg-card" />
export const E = () => (
  <Card>
    <DialogContent><div className="rounded-lg border" /></DialogContent>
    <div className="md:rounded-lg" />
  </Card>
)`
  expect(findNestedRadiusOffenders(ok)).toEqual([])
})
