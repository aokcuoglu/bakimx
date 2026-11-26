import { describe, expect, test } from "bun:test"
import { relative, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Button } from "./button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible"
import { eachTsx, jsxTagsWithAttribute } from "./jsx-source-scan"

/**
 * #950 — aç/kapa bölüm tek primitive'dir (`ui/collapsible.tsx`); çağrı yerinde
 * `aria-expanded` elle yazılmaz, Radix `aria-expanded` / `aria-controls` /
 * `data-state`'i verir.
 *
 * Kapının KÖR NOKTASI: yalnızca `aria-expanded` taşıyan etiketleri görür.
 * `aria-expanded`'siz bir aç/kapa (yalnız `{open && …}` ile gösterip gizleyen,
 * erişilebilirlik özniteliği vermeyen düğme) bu tarayıcıdan geçer; o durumu
 * kod incelemesi yakalar.
 */

function render(props: { open?: boolean; keepMounted?: boolean; asChild?: boolean }) {
  return renderToStaticMarkup(
    createElement(
      Collapsible,
      { defaultOpen: props.open },
      props.asChild
        ? createElement(CollapsibleTrigger, { asChild: true }, createElement(Button, { type: "button" }, "Aç"))
        : createElement(CollapsibleTrigger, null, "Aç"),
      createElement(CollapsibleContent, { keepMounted: props.keepMounted }, "İçerik")
    )
  )
}

const decode = (value: string) => value.replaceAll("&amp;", "&").replaceAll("&quot;", '"')

function openingTag(html: string, slot: string): string | undefined {
  return html.match(new RegExp(`<[a-z0-9]+[^>]*data-slot="${slot}"[^>]*>`))?.[0]
}

const classesOf = (tag: string) => decode(tag.match(/class="([^"]*)"/)?.[1] ?? "").split(/\s+/).filter(Boolean)

describe("Collapsible primitive (#950)", () => {
  test("kapalı: tetikleyici aria-expanded=false, panel boş ve hidden", () => {
    const html = render({})
    expect(openingTag(html, "collapsible-trigger")).toContain('aria-expanded="false"')
    expect(html).not.toContain("İçerik")
    // Radix kapalı paneli çocuksuz, `hidden` bir kabuk olarak basar.
    expect(openingTag(html, "collapsible-content")).toContain("hidden")
  })

  test("açık: aria-expanded=true, aria-controls içeriğin id'si, animasyon sınıfları", () => {
    const html = render({ open: true })
    const trigger = openingTag(html, "collapsible-trigger") ?? ""
    expect(trigger).toContain('aria-expanded="true"')
    const content = openingTag(html, "collapsible-content") ?? ""
    const controls = trigger.match(/aria-controls="([^"]+)"/)?.[1]
    expect(controls).toBeDefined()
    expect(content).toContain(`id="${controls}"`)
    const classes = classesOf(content)
    for (const cls of ["overflow-hidden", "data-[state=open]:animate-collapsible-down", "data-[state=closed]:animate-collapsible-up"]) {
      expect(classes).toContain(cls)
    }
  })

  test("keepMounted: kapalıyken de DOM'da, data-state=closed, hidden ile gizlenir, animasyonsuz", () => {
    const html = render({ keepMounted: true })
    const content = openingTag(html, "collapsible-content") ?? ""
    expect(html).toContain("İçerik")
    expect(content).toContain('data-state="closed"')
    const classes = classesOf(content)
    expect(classes).toContain("data-[state=closed]:hidden")
    expect(classes.some((cls) => cls.includes("animate-collapsible"))).toBe(false)
    expect(classes).not.toContain("overflow-hidden")
  })

  test("asChild + Button: tek bir <button>", () => {
    const html = render({ asChild: true })
    expect(html.match(/<button\b/g)?.length).toBe(1)
    expect(html).toContain('data-slot="collapsible-trigger"')
    expect(html).toContain('aria-expanded="false"')
  })
})

/**
 * Bilinçli istisnalar (src/'ye göre yol). Gerekçe 20 karakterden uzun olmalı;
 * artık eşleşmeyen satır testi düşürür.
 */
const DISCLOSURE_EXCEPTIONS: readonly { file: string; tag: string; reason: string }[] = [
  {
    file: "components/site-assistant/assistant-launcher.tsx",
    tag: "Button",
    reason:
      "Sabit konumlu başlatıcı: sayfada başka yerde bağlanan yüzen paneli açar, kendi yanında açılan satır içi bir bölge değildir.",
  },
]

const SRC = fileURLToPath(new URL("../../", import.meta.url))

/** `aria-expanded` taşıyan etiketlerden `role="combobox"` olanlar (Radix tetikleyici değil, açılır liste girdisi) serbesttir. */
function disclosureHits(source: string, file: string) {
  return jsxTagsWithAttribute(source, ["aria-expanded"], file)
    .filter((tag) => !tag.attributes.get("role")?.includes("combobox"))
    .map((tag) => ({ tag: tag.name, line: tag.line }))
}

function scanDisclosures() {
  const hits: { file: string; tag: string; line: number }[] = []
  const rawDetails: string[] = []
  eachTsx(
    SRC,
    (path, source) => {
      const file = relative(SRC, path).split(sep).join("/")
      for (const hit of disclosureHits(source, path)) hits.push({ file, ...hit })
      if (/<(?:details|summary)\b/.test(source)) rawDetails.push(file)
    },
    (path) => `${relative(SRC, path)}${sep}`.startsWith(`components${sep}ui${sep}`)
  )
  return { hits, rawDetails }
}

describe("elle açılır bölüm yok (#950)", () => {
  test("kapı elle yazılmış aria-expanded'ı yakalar, combobox ve grup sınıfına dokunmaz", () => {
    expect(disclosureHits("const a = <Button aria-expanded={open}>x</Button>", "a.tsx")).toHaveLength(1)
    expect(disclosureHits('const a = <Input role="combobox" aria-expanded={open} />', "a.tsx")).toEqual([])
    expect(disclosureHits('const a = <span className="group-aria-expanded/accordion-trigger:hidden" />', "a.tsx")).toEqual([])
  })

  test("Collapsible dışında aria-expanded yok; <details>/<summary> yok", () => {
    const { hits, rawDetails } = scanDisclosures()
    const allowed = (hit: { file: string; tag: string }) =>
      DISCLOSURE_EXCEPTIONS.some((e) => e.file === hit.file && e.tag === hit.tag)
    const offenders = hits.filter((hit) => !allowed(hit)).map((hit) => `${hit.file}:${hit.line} <${hit.tag}> aria-expanded`)
    expect([...offenders, ...rawDetails.map((file) => `${file} <details>/<summary>`)]).toEqual([])
  })

  test("istisna listesinde bayat ya da gerekçesiz satır yok", () => {
    const { hits } = scanDisclosures()
    for (const exception of DISCLOSURE_EXCEPTIONS) {
      expect(exception.reason.length).toBeGreaterThan(20)
      expect(hits.some((hit) => hit.file === exception.file && hit.tag === exception.tag)).toBe(true)
    }
  })
})
