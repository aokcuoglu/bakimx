import { describe, expect, test } from "bun:test"
import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { relative, sep } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { Autocomplete, AutocompleteInput, AutocompleteInputGroup } from "./autocomplete"
import { Combobox, ComboboxInput } from "./combobox"
import { InputGroup, InputGroupAddon, InputGroupInput } from "./input-group"
import { eachTsx } from "./jsx-source-scan"

/**
 * #888 — InputGroup sözleşmesi.
 *
 * 1. Odak halkası grupta çizilir; iç girdi (`InputGroupInput`) kendi halkasını
 *    kapatır. Grup seçicisi iç denetimin `data-slot`'una bağlı OLMAMALI: Base UI
 *    `render` birleştirmesi `AutocompleteInput`'un slot'unu iç girdiye
 *    geçiriyordu ve "Parça ekle" araması odakta hiç halka göstermiyordu
 *    (WCAG 2.4.7).
 * 2. Eklentili grupta Autocomplete popup'ı girdiye değil kutuya çapalanır:
 *    `AutocompleteInputGroup` (Base UI `Autocomplete.InputGroup`). Düz
 *    `InputGroup` içinde liste eklenti genişliği kadar dar ve sola kaymış açılır.
 */

const tagsOf = (html: string, tag: string) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, "g"))].map((m) => m[0])
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? null
const classes = (tag: string) => (attr(tag, "class") ?? "").split(/\s+/)

/** Grubun odak halkası, iç girdinin slot'undan bağımsız olarak girdiyi yakalar. */
function expectGroupRing(html: string) {
  const group = tagsOf(html, "div").find((tag) => attr(tag, "data-slot") === "input-group")
  // Base UI'ın form için eklediği gizli girdi (aria-hidden) sayılmaz.
  const input = tagsOf(html, "input").find((tag) => attr(tag, "aria-hidden") !== "true")
  expect(group).toBeDefined()
  expect(input).toBeDefined()
  const groupClasses = classes(group!)
  expect(groupClasses).toContain("has-[input:focus-visible]:ring-4")
  expect(groupClasses).toContain("has-[input:focus-visible]:ring-ring/20")
  expect(groupClasses).toContain("has-[input:focus-visible]:border-ring")
  // Slot'a bağlı seçici geri gelmesin (ezilen slot halkayı öldürüyordu).
  expect(groupClasses.some((cls) => cls.includes("data-slot=input-group-control]:focus"))).toBe(false)
  // İç girdi kendi halkasını kapatır → halka yalnız grupta.
  expect(classes(input!)).toContain("focus-visible:ring-0")
  expect(attr(input!, "data-slot")).toBe("input-group-control")
}

describe("InputGroup odak halkası (#888)", () => {
  test("AutocompleteInput render={<InputGroupInput/>} grup halkasını korur", () => {
    const html = renderToStaticMarkup(
      h(
        Autocomplete,
        { items: [] },
        h(
          AutocompleteInputGroup,
          null,
          h(AutocompleteInput, { render: h(InputGroupInput, { placeholder: "Parça ara" }) }),
          h(InputGroupAddon, { align: "inline-end" }, "x")
        )
      )
    )
    expectGroupRing(html)
  })

  test("düz InputGroup içindeki AutocompleteInput da halkayı kaybetmez", () => {
    const html = renderToStaticMarkup(
      h(Autocomplete, { items: [] }, h(InputGroup, null, h(AutocompleteInput, { render: h(InputGroupInput) })))
    )
    expectGroupRing(html)
  })

  test("ComboboxInput ve yalın InputGroupInput aynı halkayı taşır", () => {
    expectGroupRing(renderToStaticMarkup(h(Combobox, { items: [] }, h(ComboboxInput, { placeholder: "İl" }))))
    expectGroupRing(renderToStaticMarkup(h(InputGroup, null, h(InputGroupInput))))
  })

  test("AutocompleteInputGroup InputGroup ölçüsünü ve sınıfını taşır", () => {
    const html = renderToStaticMarkup(
      h(Autocomplete, { items: [] }, h(AutocompleteInputGroup, { size: "compact", className: "w-32" }, h(AutocompleteInput, { render: h(InputGroupInput) })))
    )
    const group = tagsOf(html, "div").find((tag) => attr(tag, "data-slot") === "input-group")!
    expect(attr(group, "data-size")).toBe("compact")
    expect(classes(group)).toContain("w-32")
  })
})

describe("Autocomplete popup'ı eklentili grubun kutusuna çapalanır (#888)", () => {
  const SRC = fileURLToPath(new URL("../../", import.meta.url))

  test("InputGroupInput'u render eden AutocompleteInput, AutocompleteInputGroup içindedir", () => {
    const offenders: string[] = []
    eachTsx(SRC, (path, source) => {
      if (!source.includes("AutocompleteInput")) return
      const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
      const visit = (node: ts.Node) => {
        if (
          (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
          node.tagName.getText(file) === "AutocompleteInput" &&
          node.attributes.properties.some(
            (prop) => ts.isJsxAttribute(prop) && prop.name.getText(file) === "render" && /<InputGroupInput\b/.test(prop.getText(file))
          )
        ) {
          // En yakın kapsayan JSX öğesi.
          let parent: ts.Node | undefined = ts.isJsxOpeningElement(node) ? node.parent.parent : node.parent
          while (parent && !ts.isJsxElement(parent)) parent = parent.parent
          const container = parent && ts.isJsxElement(parent) ? parent.openingElement.tagName.getText(file) : "(yok)"
          if (container !== "AutocompleteInputGroup") {
            const line = file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1
            offenders.push(`${relative(SRC, path).split(sep).join("/")}:${line} <${container}>`)
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(file)
    })
    expect(offenders).toEqual([])
  })
})
