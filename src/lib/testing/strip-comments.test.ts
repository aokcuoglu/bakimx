import { describe, expect, test } from "bun:test"
import { stripComments } from "./strip-comments"

describe("stripComments", () => {
  test("gerçek blok ve satır yorumlarını aynı uzunlukta boşlukla değiştirir", () => {
    const src = "const a = 1 // not\n/* blok\nçok satır */ const b = 2"
    const out = stripComments(src)
    expect(out).not.toContain("not")
    expect(out).not.toContain("blok")
    expect(out).toContain("const a = 1")
    expect(out).toContain("const b = 2")
    expect(out.length).toBe(src.length)
    expect(out.split("\n").length).toBe(src.split("\n").length)
  })

  test("dize içindeki /* yorum başlatmaz (accept=image/*, glob)", () => {
    const src = '<Input accept="image/*" />\nconst a = d.toLocaleDateString("tr-TR")\n{/* c */}'
    const out = stripComments(src)
    expect(out).toContain('toLocaleDateString("tr-TR")')
    expect(out).not.toContain("c */")
    expect(stripComments('const g = "src/**/*.tsx"; foo()')).toContain("foo()")
  })

  test("URL içindeki // yorum sayılmaz", () => {
    const out = stripComments('const u = "https://x.test/a"; bar() // yorum')
    expect(out).toContain("https://x.test/a")
    expect(out).toContain("bar()")
    expect(out).not.toContain("yorum")
  })

  test("şablon dizesi ve ${} içeriği korunur", () => {
    const src = "const t = `a /* b ${x + `// ${y}`} c */ d`; after()"
    const out = stripComments(src)
    expect(out).toBe(src)
  })

  test("düzenli ifade değişmezi içindeki /* ve // korunur", () => {
    const src = "const r = /\\/\\*[\\s\\S]*?\\*\\//g; keep() /* gone */"
    const out = stripComments(src)
    expect(out).toContain("/\\/\\*[\\s\\S]*?\\*\\//g")
    expect(out).toContain("keep()")
    expect(out).not.toContain("gone")
    expect(stripComments("const r = /a*/; x()")).toContain("x()")
  })

  test("bölme işlemi düzenli ifade sanılmaz", () => {
    const out = stripComments("const q = a / b; const w = c / d // yorum")
    expect(out).toContain("c / d")
    expect(out).not.toContain("yorum")
  })

  test("JSX yorumu silinir, çevresindeki kod kalır", () => {
    const out = stripComments("<div>{/* gizli */}<Foo /></div>")
    expect(out).not.toContain("gizli")
    expect(out).toContain("<Foo />")
  })
})
