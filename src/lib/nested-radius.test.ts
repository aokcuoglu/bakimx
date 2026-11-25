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
  // Dosya-yerel Card sarmalayıcısı (customer-detail.tsx)
  "SectionCard",
])
// Diyalog kabuğu (18px) önceki kapları sıfırlar ve kendisi tek kap olur; içindeki kutu iç kutudur.
const RESET_TAGS = new Set(["DialogContent", "AlertDialogContent", "SheetContent"])
// Yüzen/kap öğenin kendi köşesi kontrol edilmez (kabuk olarak köşesi serbest).
const FLOATING_TAGS = new Set(["PopoverContent", "DropdownMenuContent", "SelectContent"])

const OFFENDER = /(?<![\w-])rounded(?:-(?:[trbl]|s|e|tl|tr|bl|br|ss|se|es|ee))?-(?:lg|xl)(?![\w-])/
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
  let depth = 0 // açık 12-18px kap sayısı (diyalog kabuğunda 1'e sıfırlanır)

  const check = (opening: ts.JsxOpeningElement | ts.JsxSelfClosingElement) => {
    const tag = opening.tagName.getText(parsed)
    if (FLOATING_TAGS.has(tag) || RESET_TAGS.has(tag)) return
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
      if (RESET_TAGS.has(opening.tagName.getText(parsed))) depth = 1
      else if (isContainer(opening)) depth += 1
      for (const child of node.children) visit(child)
      // Öznitelikler içindeki JSX (render prop vb.) da taransın
      opening.attributes.properties.forEach(visit)
      depth = saved
      return
    }
    if (ts.isJsxSelfClosingElement(node)) {
      check(node)
      const saved = depth
      if (RESET_TAGS.has(node.tagName.getText(parsed))) depth = 1
      else if (isContainer(node)) depth += 1
      node.attributes.properties.forEach(visit)
      depth = saved
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
    <PopoverContent className="rounded-xl"><div className="rounded-md" /></PopoverContent>
    <div className="md:rounded-md" />
  </Card>
)`
  expect(findNestedRadiusOffenders(ok)).toEqual([])

  // Diyalog kabuğu içindeki kutu iç kutudur (18px kap)
  const inDialog = `export const F = () => (
  <DialogContent>
    <div className="rounded-lg border p-3" />
  </DialogContent>
)`
  expect(findNestedRadiusOffenders(inDialog)).toEqual([3])

  const variants = `export const G = ({ on, tone }: { on: boolean; tone: string }) => (
  <Card>
    <div className={\`flex \${tone} rounded-xl\`} />
    <div className={on ? "rounded-lg" : "rounded-md"} />
    <div className={cn({ "rounded-lg": on })} />
    <div className="sm:rounded-lg" />
    <div className="hover:rounded-xl" />
    <div className="rounded-s-lg" />
    <div className="rounded-ee-xl" />
  </Card>
)`
  expect(findNestedRadiusOffenders(variants)).toEqual([3, 4, 5, 6, 7, 8, 9])

  const selfClosing = `export const H = () => (
  <Card>
    <Foo icon={<div className="rounded-lg" />} />
  </Card>
)
export const I = () => <Card header={<div className="rounded-lg" />} />`
  expect(findNestedRadiusOffenders(selfClosing)).toEqual([3, 6])

  const sectionCard = `export const J = () => (
  <SectionCard><div className="rounded-lg" /></SectionCard>
)`
  expect(findNestedRadiusOffenders(sectionCard)).toEqual([2])
})
