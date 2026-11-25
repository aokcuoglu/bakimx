import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import ts from "typescript"

/**
 * Kaynak kapıları için ortak JSX tarayıcısı (control-sizing.test.ts,
 * control-call-sites.test.ts). Yalnız testler içe aktarır.
 *
 * Metin regex'i yerine TypeScript ayrıştırıcısı kullanılır: açılış etiketi,
 * ok fonksiyonlu prop'lar, `[&>svg]` sınıfları ve iç içe `render={<Input />}`
 * öğeleri doğru sınırlanır; `className` ifadesindeki `cn(...)`, koşullu ve
 * şablon dizgilerinin sabit parçaları tek tek okunur.
 * Sınırı: sabite çıkarılmış sınıfları (`const cls = "h-7"`) ve bileşene
 * dışarıdan geçen `className` değişkeninin değerini görmez — ikincisini
 * `forwardsClassName` ile işaretler.
 */
export type JsxOpeningTag = {
  /** Etiket adı (`Input`, `TabsTrigger`…). */
  name: string
  /** 1 tabanlı satır. */
  line: number
  /** Açılış etiketinin kaynak metni (`<Input … />` ya da `<Input …>`). */
  text: string
  /** `className` ifadesindeki dizge sabitleri; prop yoksa boş. */
  classLiterals: string[]
  /** `className` ifadesindeki CSS modülü başvuruları (`styles.input`). */
  cssModuleRefs: string[]
  /** `className` ifadesi bir `className` değişkenini/prop'unu iletiyor mu. */
  forwardsClassName: boolean
  /** Etiketi içeren en yakın adlı fonksiyon/bileşen (`FilterSelect`). */
  owner: string | null
  /** Etiketin kendi prop'ları: ad → kaynak metni (`size` → `"compact"`). */
  attributes: Map<string, string>
}

type ClassInfo = Pick<JsxOpeningTag, "classLiterals" | "cssModuleRefs" | "forwardsClassName">

function readClassExpression(node: ts.Node, file: ts.SourceFile, cssModules: Set<string>, out: ClassInfo) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    out.classLiterals.push(node.text)
    return
  }
  if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
    out.classLiterals.push(node.text)
    return
  }
  if (
    (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
    ts.isIdentifier(node.expression) &&
    cssModules.has(node.expression.text)
  ) {
    out.cssModuleRefs.push(node.getText(file))
    return
  }
  if (ts.isIdentifier(node) && node.text === "className") out.forwardsClassName = true
  // className içine gömülü bir JSX öğesi kendi etiketi olarak ayrıca taranır.
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) return
  ts.forEachChild(node, (child) => readClassExpression(child, file, cssModules, out))
}

/** `import styles from "./x.module.css"` ile bağlanan adlar. */
function cssModuleImports(file: ts.SourceFile) {
  const names = new Set<string>()
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
    if (!statement.moduleSpecifier.text.endsWith(".module.css")) continue
    const clause = statement.importClause
    if (clause?.name) names.add(clause.name.text)
    if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) names.add(clause.namedBindings.name.text)
  }
  return names
}

function ownerOf(node: ts.Node): string | null {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isFunctionDeclaration(parent) && parent.name) return parent.name.text
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text
  }
  return null
}

/** `source` içindeki, adı `names` listesinde olan JSX açılış etiketleri. */
export function jsxOpeningTags(source: string, names: readonly string[], fileName = "scan.tsx"): JsxOpeningTag[] {
  const wanted = new Set(names)
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const cssModules = cssModuleImports(file)
  const tags: JsxOpeningTag[] = []
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = node.tagName.getText(file)
      if (wanted.has(name)) {
        const attributes = new Map<string, string>()
        const info: ClassInfo = { classLiterals: [], cssModuleRefs: [], forwardsClassName: false }
        for (const prop of node.attributes.properties) {
          if (!ts.isJsxAttribute(prop)) continue
          const attr = prop.name.getText(file)
          attributes.set(attr, prop.initializer?.getText(file) ?? "true")
          if (attr === "className" && prop.initializer) readClassExpression(prop.initializer, file, cssModules, info)
        }
        tags.push({
          name,
          line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
          text: node.getText(file),
          ...info,
          owner: ownerOf(node),
          attributes,
        })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return tags
}

/**
 * Tailwind sınıfının çekirdeği: `!` önek/soneki ve `md:` / `data-[…]:` /
 * `[&>input]:` gibi varyant önekleri atılır (köşeli parantez içindeki `:`
 * bölmez). `md:h-7!` → `h-7`.
 */
export function utilityCore(token: string): string {
  const parts = splitVariants(token)
  return parts[parts.length - 1].replace(/^!/, "").replace(/!$/, "")
}

/**
 * Tailwind sınıfının varyant önekleri, sırasıyla: `md:hover:bg-muted` →
 * `["md", "hover"]`, `[&_svg]:size-4` → `["[&_svg]"]`, `h-7` → `[]`.
 */
export function utilityVariants(token: string): string[] {
  return splitVariants(token).slice(0, -1)
}

/** Köşeli / yuvarlak parantez dışındaki `:` işaretlerinden böler. */
function splitVariants(token: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < token.length; i++) {
    const ch = token[i]
    if (ch === "[" || ch === "(") depth++
    else if (ch === "]" || ch === ")") depth--
    else if (ch === ":" && depth === 0) {
      parts.push(token.slice(start, i))
      start = i + 1
    }
  }
  parts.push(token.slice(start))
  return parts
}

/** `dir` altındaki `.tsx` dosyaları; `skip` göreli yolu dışarıda bırakır. */
export function eachTsx(dir: string, visit: (path: string, source: string) => void, skip?: (path: string) => boolean) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (skip?.(path)) continue
    if (entry.isDirectory()) eachTsx(path, visit, skip)
    else if (entry.name.endsWith(".tsx")) visit(path, readFileSync(path, "utf8"))
  }
}
