import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./accordion"

type Variant = "default" | "card" | "disclosure"

/** Tek öğeli akordeonu basar; `open` ise öğe açık gelir (içerik render edilir). */
function render(variant: Variant | undefined, open = false) {
  return renderToStaticMarkup(
    createElement(
      Accordion,
      { type: "single", collapsible: true, variant, defaultValue: open ? "a" : undefined },
      createElement(
        AccordionItem,
        { value: "a" },
        createElement(AccordionTrigger, null, "Başlık"),
        createElement(AccordionContent, null, "İçerik")
      )
    )
  )
}

const decode = (value: string) => value.replaceAll("&amp;", "&").replaceAll("&quot;", '"')

/** `data-slot="<slot>"` taşıyan öğenin açılış etiketi. */
function openingTag(html: string, slot: string): string {
  const tag = html.match(new RegExp(`<[a-z0-9]+[^>]*data-slot="${slot}"[^>]*>`))?.[0]
  expect(tag).toBeDefined()
  return tag ?? ""
}

function classesOf(tag: string): string[] {
  return decode(tag.match(/class="([^"]*)"/)?.[1] ?? "").split(/\s+/).filter(Boolean)
}

const slotClasses = (html: string, slot: string) => classesOf(openingTag(html, slot))

/** İçerik panelinin (`AccordionContent`) iç kapsayıcısının sınıfları. */
function contentInnerClasses(html: string): string[] {
  const inner = html.match(/data-slot="accordion-content"[^>]*>\s*(<div[^>]*>)/)?.[1]
  expect(inner).toBeDefined()
  return classesOf(inner ?? "")
}

describe("Accordion görünümleri (#926)", () => {
  test("card: kökte variant, kenarlıksız kart öğe, kontrol yüksekliğinde tetikleyici", () => {
    const html = render("card")
    expect(openingTag(html, "accordion")).toContain('data-variant="card"')
    expect(openingTag(html, "accordion-trigger")).toContain('aria-expanded="false"')

    const root = slotClasses(html, "accordion")
    expect(root).toContain("gap-2")

    // e-santral kartı: kenarlık yok, ui/card.tsx'in soluk halkası.
    const item = slotClasses(html, "accordion-item")
    for (const cls of ["rounded-lg", "bg-card", "ring-1", "ring-foreground/[0.05]"]) expect(item).toContain(cls)
    expect(item.some((cls) => /^border(?:-|$)/.test(cls))).toBe(false)

    const trigger = slotClasses(html, "accordion-trigger")
    for (const cls of ["min-h-(--control-h)", "px-4", "py-3"]) expect(trigger).toContain(cls)
    expect(trigger).not.toContain("hover:underline")
    expect(trigger.some((cls) => /^h-/.test(cls))).toBe(false)
    // Kenarlık olmadığı için tetikleyici kartın köşesini aynen taşır.
    expect(trigger).toContain("rounded-lg")
    expect(trigger.some((cls) => cls.startsWith("rounded-["))).toBe(false)

    const content = contentInnerClasses(render("card", true))
    for (const cls of ["px-4", "pt-0", "pb-4"]) expect(content).toContain(cls)
    expect(content).not.toContain("[&_a]:underline")
  })

  test("default: alt çizgili liste, düzyazı bağlantı kuralları yalnız burada", () => {
    const html = render(undefined)
    expect(openingTag(html, "accordion")).toContain('data-variant="default"')

    const item = slotClasses(html, "accordion-item")
    expect(item).toContain("not-last:border-b")
    expect(item).not.toContain("bg-card")

    const trigger = slotClasses(html, "accordion-trigger")
    expect(trigger).toContain("min-h-(--control-h)")
    expect(trigger).toContain("py-3")
    expect(trigger).not.toContain("hover:underline")
    expect(trigger).not.toContain("py-2.5")

    const content = contentInnerClasses(render("default", true))
    expect(content).toContain("[&_a]:underline")
    expect(content).toContain("pb-3")
  })

  test("disclosure: kart görünümlü tetikleyici, öğe çerçevesiz", () => {
    const html = render("disclosure")
    expect(openingTag(html, "accordion")).toContain('data-variant="disclosure"')
    expect(slotClasses(html, "accordion-item")).toEqual([])

    const trigger = slotClasses(html, "accordion-trigger")
    for (const cls of ["min-h-(--control-h)", "items-center", "bg-card", "px-4", "ring-1", "ring-foreground/[0.05]"]) {
      expect(trigger).toContain(cls)
    }
    expect(trigger).not.toContain("items-start")
    // Kapalı başlığın oku koyu tonda (16px kalır): dokunulabilir olduğu belli olsun.
    expect(trigger).toContain("**:data-[slot=accordion-trigger-icon]:text-foreground")
    expect(trigger).not.toContain("**:data-[slot=accordion-trigger-icon]:text-muted-foreground")
    expect(trigger).toContain("**:data-[slot=accordion-trigger-icon]:size-4")

    const content = contentInnerClasses(render("disclosure", true))
    expect(content).toEqual(["pt-2", "pb-0"])
  })

  test("iç kapsayıcı Radix içerik yüksekliğine sabitlenmez", () => {
    // Yorumdaki gerekçe kalır; sınıf dizgelerinde değişken geçmez.
    const source = readFileSync(join(import.meta.dir, "accordion.tsx"), "utf8")
    const code = source.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "")
    expect(code).not.toContain("h-(--radix-accordion-content-height)")
    expect(source).toContain("BİLİNÇLİ OLARAK ALMIYORUZ")

    for (const variant of ["default", "card", "disclosure"] as const) {
      expect(contentInnerClasses(render(variant, true)).some((cls) => cls.includes("radix-accordion-content-height"))).toBe(false)
    }
  })
})
