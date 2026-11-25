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
 * dışarıdan geçen `className` değişkenini görmez.
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
  /** Etiketin kendi prop'ları: ad → kaynak metni (`size` → `"compact"`). */
  attributes: Map<string, string>
}

function literalsIn(node: ts.Node, out: string[]) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    out.push(node.text)
    return
  }
  if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
    out.push(node.text)
    return
  }
  // className içine gömülü bir JSX öğesi kendi etiketi olarak ayrıca taranır.
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) return
  ts.forEachChild(node, (child) => literalsIn(child, out))
}

/** `source` içindeki, adı `names` listesinde olan JSX açılış etiketleri. */
export function jsxOpeningTags(source: string, names: readonly string[], fileName = "scan.tsx"): JsxOpeningTag[] {
  const wanted = new Set(names)
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const tags: JsxOpeningTag[] = []
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = node.tagName.getText(file)
      if (wanted.has(name)) {
        const attributes = new Map<string, string>()
        const classLiterals: string[] = []
        for (const prop of node.attributes.properties) {
          if (!ts.isJsxAttribute(prop)) continue
          const attr = prop.name.getText(file)
          attributes.set(attr, prop.initializer?.getText(file) ?? "true")
          if (attr === "className" && prop.initializer) literalsIn(prop.initializer, classLiterals)
        }
        tags.push({
          name,
          line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
          text: node.getText(file),
          classLiterals,
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
  let depth = 0
  let start = 0
  for (let i = 0; i < token.length; i++) {
    const ch = token[i]
    if (ch === "[" || ch === "(") depth++
    else if (ch === "]" || ch === ")") depth--
    else if (ch === ":" && depth === 0) start = i + 1
  }
  return token.slice(start).replace(/^!/, "").replace(/!$/, "")
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
