import { describe, expect, test } from "bun:test"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import ts from "typescript"
import { BRAND_NAME, HOME_TITLE, TITLE_TEMPLATE, brandedTitle, publicPageMetadata } from "./seo"

const appDir = path.join(process.cwd(), "src/app")
function pages(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name)
    return entry.isDirectory() ? pages(file) : entry.name === "page.tsx" ? [file] : []
  })
}
// These routes render no screen: Next redirects to a page with its own title.
const redirects = new Set([
  "(app)/inventory/page.tsx", "(app)/cash/page.tsx",
  "(app)/workshop/page.tsx", "(app)/billing/quota/page.tsx",
  "onboarding/page.tsx",
])

describe("browser title contract (#642)", () => {
  test("brand and root template use the same spelling exactly once", () => {
    expect(BRAND_NAME).toBe("BakımX")
    expect(TITLE_TEMPLATE).toBe("%s | BakımX")
    expect(HOME_TITLE).toBe("BakımX: Oto Servis Yönetim Platformu")
    expect(brandedTitle("İş Emirleri")).toBe("İş Emirleri | BakımX")
    const metadata = publicPageMetadata({ path: "/blog", brandFirst: true, title: "Blog: Servis Yönetimi ve Rehberler", description: "Rehberler" })
    expect(metadata.title).toEqual({ absolute: "BakımX Blog: Servis Yönetimi ve Rehberler" })
    expect(metadata.openGraph).toMatchObject({ title: "BakımX Blog: Servis Yönetimi ve Rehberler", siteName: BRAND_NAME })
    expect(metadata.twitter).toMatchObject({ title: "BakımX Blog: Servis Yönetimi ve Rehberler" })
  })

  test("nested layouts preserve the brand template for their children", () => {
    for (const layout of ["layout.tsx", "(app)/layout.tsx", "admin/layout.tsx"]) {
      const source = readFileSync(path.join(appDir, layout), "utf8")
      expect(source).toContain("template: TITLE_TEMPLATE")
    }
  })

  for (const file of pages(appDir)) {
    const route = path.relative(appDir, file)
    test(`${route} declares its own server title`, () => {
      const metadataFile = ["blog/page.tsx", "contact-us/page.tsx"].includes(route)
        ? path.join(path.dirname(file), "layout.tsx") : file
      const source = readFileSync(metadataFile, "utf8")
      if (redirects.has(route)) {
        expect(source).toContain("redirect(")
        return
      }
      const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
      const exports = ast.statements.filter((node) =>
        ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
      )
      const metadata = exports.flatMap((node) => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [])
        .find((node) => node.name.getText(ast) === "metadata")
      const dynamic = exports.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "generateMetadata")
      expect(Boolean(metadata || dynamic)).toBe(true)
      expect(source.trimStart().startsWith('"use client"')).toBe(false)
      if (metadata) {
        const initializer = metadata.initializer!
        const object = ts.isObjectLiteralExpression(initializer) ? initializer
          : ts.isCallExpression(initializer) && ts.isObjectLiteralExpression(initializer.arguments[0]) ? initializer.arguments[0] : undefined
        expect(object).toBeDefined()
        const title = object!.properties.find((prop) => ts.isPropertyAssignment(prop) && prop.name.getText(ast) === "title")
        expect(title).toBeDefined()
        if (title && ts.isPropertyAssignment(title) && ts.isStringLiteral(title.initializer)) {
          const text = title.initializer.text
          expect(text.trim()).toBe(text)
          expect(text.length).toBeGreaterThan(2)
          expect(text).not.toMatch(/Bak[iı]mX/i)
          expect(text).not.toMatch(/^[/|]|[|]$/)
        }
      }
    })
  }
})
