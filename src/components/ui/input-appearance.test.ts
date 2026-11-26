import { describe, expect, test } from "bun:test"
import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { Autocomplete, AutocompleteInput, AutocompleteInputGroup } from "./autocomplete"
import { Combobox, ComboboxInput } from "./combobox"
import { Input } from "./input"
import { InputGroup, InputGroupInput } from "./input-group"

/**
 * #952 — `appearance` varyantı. Hayalet alan görünümü çağrı yerinde ata
 * seçicisiyle değil, Input / InputGroup'un kendi varyantıyla verilir.
 */

const tagsOf = (html: string, tag: string) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, "g"))].map((m) => m[0])
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? null
const decode = (value: string) =>
  value.replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
const classes = (tag: string) => decode(attr(tag, "class") ?? "").split(/\s+/)

const inputTag = (appearance?: "ghost" | "inline") =>
  tagsOf(renderToStaticMarkup(h(Input, { appearance })), "input")[0]
const groupTag = (appearance?: "ghost" | "quiet" | "soft") =>
  tagsOf(renderToStaticMarkup(h(InputGroup, { appearance }, h(InputGroupInput))), "div").find(
    (tag) => attr(tag, "data-slot") === "input-group"
  )!

describe("Input appearance", () => {
  test("ghost: saydam kenarlık, odakta halka kalır", () => {
    const c = classes(inputTag("ghost"))
    expect(c).toContain("border-transparent")
    expect(c).toContain("focus-visible:border-ring")
    expect(c).not.toContain("border-input")
    expect(c).not.toContain("bg-card")
    expect(attr(inputTag("ghost"), "data-appearance")).toBe("ghost")
  })

  test("inline: dolgu 0, odakta alan dolgusu", () => {
    const c = classes(inputTag("inline"))
    expect(c).toContain("px-0")
    expect(c).toContain("focus-visible:px-(--field-px)")
    expect(c).not.toContain("px-(--field-px)")
    expect(attr(inputTag("inline"), "data-appearance")).toBe("inline")
  })

  test("default değişmez ve data-appearance yazmaz", () => {
    const tag = inputTag()
    const c = classes(tag)
    expect(c).toContain("border-input")
    expect(c).toContain("bg-card")
    expect(attr(tag, "data-appearance")).toBeNull()
  })
})

describe("InputGroup appearance", () => {
  for (const appearance of ["ghost", "quiet", "soft"] as const) {
    test(`${appearance}: odak halkası korunur, çıplak border-input yok`, () => {
      const tag = groupTag(appearance)
      const c = classes(tag)
      expect(c).toContain("border-transparent")
      expect(c).toContain("has-[input:focus-visible]:border-ring")
      expect(c).not.toContain("border-input")
      expect(attr(tag, "data-appearance")).toBe(appearance)
    })
  }

  test("default değişmez", () => {
    const tag = groupTag()
    expect(classes(tag)).toContain("border-input")
    expect(attr(tag, "data-appearance")).toBeNull()
  })

  test("ComboboxInput ve AutocompleteInputGroup görünümü gruba iletir", () => {
    const combo = renderToStaticMarkup(h(Combobox, { items: [] }, h(ComboboxInput, { appearance: "ghost" })))
    const group = tagsOf(combo, "div").find((tag) => attr(tag, "data-slot") === "input-group")!
    expect(attr(group, "data-appearance")).toBe("ghost")

    const auto = renderToStaticMarkup(
      h(Autocomplete, { items: [] }, h(AutocompleteInputGroup, { appearance: "soft" }, h(AutocompleteInput, { render: h(InputGroupInput) })))
    )
    const autoGroup = tagsOf(auto, "div").find((tag) => attr(tag, "data-slot") === "input-group")!
    expect(attr(autoGroup, "data-appearance")).toBe("soft")
  })
})

describe("appearance kaynak sözleşmesi", () => {
  const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8")
  const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")

  test("Input / InputGroup görünümü data-[appearance=…] ile biçimlemez", () => {
    expect(read("./input.tsx")).not.toContain("data-[appearance=")
    expect(read("./input-group.tsx")).not.toContain("data-[appearance=")
  })

  test("ileten sarmalayıcılar appearance'ı geçirir", () => {
    expect(read("../parts/part-attribute-field.tsx")).toContain("appearance={appearance}")
    expect(read("../orders/order-item-unit-combobox.tsx")).toContain("appearance={appearance}")
  })

  test("parts-labor-grid ata seçicisi ve ! ezmesi kullanmaz", () => {
    const src = stripComments(read("../orders/parts-labor-grid.tsx"))
    expect(src).not.toMatch(/\[&_\[data-slot=/)
    expect(src).not.toMatch(/\[&_input\]/)
    expect(src).not.toMatch(/:!(?=[a-z[(-])/)
    expect(src).not.toMatch(/\]:!/)
    expect(src).not.toContain("META_FIELD")
    expect(src).toContain('const GHOST_ROW = "group group/field-row transition-colors hover:bg-muted/40"')
  })
})
