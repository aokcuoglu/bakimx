import { describe, expect, test } from "bun:test"
import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { Autocomplete, AutocompleteInput, AutocompleteInputGroup } from "./autocomplete"
import { Combobox, ComboboxInput } from "./combobox"
import { fieldToneClasses } from "./field-tone"
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
    expect(c).not.toContain("dark:bg-input/30")
    expect(c).not.toContain("disabled:bg-input/50")
    expect(c).toContain("disabled:bg-transparent")
  })

  test("inline: dolgu 0, odakta alan dolgusu", () => {
    const c = classes(inputTag("inline"))
    expect(c).toContain("px-0")
    expect(c).toContain("focus-visible:px-(--field-px)")
    expect(c).not.toContain("px-(--field-px)")
    expect(attr(inputTag("inline"), "data-appearance")).toBe("inline")
    expect(c).not.toContain("dark:bg-input/30")
    expect(c).not.toContain("disabled:bg-input/50")
    expect(c).toContain("disabled:bg-transparent")
  })

  test("default değişmez ve data-appearance yazmaz", () => {
    const tag = inputTag()
    const c = classes(tag)
    expect(c).toContain("border-input")
    expect(c).toContain("bg-card")
    expect(attr(tag, "data-appearance")).toBeNull()
    expect(decode(attr(tag, "class") ?? "")).toBe(
      "h-(--control-h) w-full min-w-0 rounded-(--control-radius) border border-input bg-card px-(--field-px) py-1 text-(length:--control-fs) tracking-[-0.01em] transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/10 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/20 data-[size=sm]:[--control-h:var(--control-h-sm)] data-[size=compact]:[--control-h:var(--control-h-xs)] data-[size=compact]:[--control-fs:var(--control-fs-field-xs)] data-[size=compact]:[--field-px:var(--control-px-xs)] data-[size=lg]:[--control-h:var(--control-h-lg)] " +
        // OCR düşük güven tonu (#953): yalnız `data-tone="warning"` iken etkin.
        fieldToneClasses
    )
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

  test("ghost: devre dışı grup varsayılan dolguyu geri almaz", () => {
    const c = classes(groupTag("ghost"))
    expect(c).toContain("has-disabled:bg-transparent")
    expect(c).toContain("dark:has-disabled:bg-transparent")
  })

  test("quiet ve soft: koyu mod ve devre dışı karşılıkları var", () => {
    const quiet = classes(groupTag("quiet"))
    for (const c of ["has-disabled:bg-transparent", "dark:bg-transparent", "dark:focus-within:bg-background", "dark:has-disabled:bg-transparent"])
      expect(quiet).toContain(c)
    const soft = classes(groupTag("soft"))
    for (const c of ["has-disabled:bg-muted/60", "dark:bg-muted/60", "dark:focus-within:bg-background", "dark:has-disabled:bg-muted/60"])
      expect(soft).toContain(c)
  })

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
