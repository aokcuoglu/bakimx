import { describe, expect, test } from "bun:test"
import { createElement as h, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { readFileSync } from "node:fs"
import { relative, sep } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"
import { Combobox as ComboboxPrimitive } from "@base-ui/react"
import { Autocomplete, AutocompleteInput, AutocompleteInputGroup } from "./autocomplete"
import { Combobox, ComboboxContent, ComboboxInput } from "./combobox"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "./input-group"
import { eachTsx, utilityCore } from "./jsx-source-scan"

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
 *
 * #887 — dar hücre ve Combobox çapası.
 *
 * 3. Satır içi eklenti grubun içerik kutusundan taşmaz: negatif dış boşluk
 *    (`mr-[-0.3rem]`) yok, eklenti `shrink-0`, küçülen girdidir (`min-w-0`).
 *    Eklentili yanda girdinin dolgusu daralır; sığmayan placeholder `…` ile
 *    biter (390px iki kolonlu Marka/Model'de "Marka seçi" kesiliyordu).
 * 4. `ComboboxInput`'un kabı Base UI `Combobox.InputGroup`'tur: popup girdiye
 *    değil kutuya çapalanır (liste 1px içeriden başlayıp ⌄ kadar kısa
 *    bitiyordu). Popup'ta girdi çapasını telafi eden `+--spacing(7)` genişlik
 *    hilesi yok. Chip'li çoklu seçim chip kabına açıkça çapalanır.
 */

const tagsOf = (html: string, tag: string) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, "g"))].map((m) => m[0])
const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? null
const decode = (value: string) =>
  value.replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&")
const classes = (tag: string) => decode(attr(tag, "class") ?? "").split(/\s+/)

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

describe("dar hücrede grup içeriği kutuya sığar (#887)", () => {
  const html = renderToStaticMarkup(
    h(
      InputGroup,
      null,
      h(InputGroupAddon, { align: "inline-start" }, h(InputGroupButton, { size: "icon-xs", "aria-label": "Ara" }, "s")),
      h(InputGroupInput, { placeholder: "Marka seçin veya yazın" }),
      h(InputGroupAddon, { align: "inline-end" }, h(InputGroupButton, { size: "icon-xs", "aria-label": "Aç" }, "v"))
    )
  )
  const group = classes(tagsOf(html, "div").find((tag) => attr(tag, "data-slot") === "input-group")!)
  const input = classes(tagsOf(html, "input")[0])
  const addons = tagsOf(html, "div").filter((tag) => attr(tag, "data-slot") === "input-group-addon")

  test("girdi küçülen öğedir ve sığmayan metni … ile bitirir", () => {
    expect(input).toContain("flex-1")
    expect(input).toContain("min-w-0")
    expect(input).toContain("text-ellipsis")
  })

  test("eklentili yanda girdinin dolgusu --field-px'ten dardır", () => {
    expect(group).toContain("has-[>[data-align=inline-start]]:[&>input]:pl-1.5")
    expect(group).toContain("has-[>[data-align=inline-end]]:[&>input]:pr-1.5")
    // Eklentisiz yan Input'un dolgusunu korur.
    expect(input).toContain("px-(--field-px)")
  })

  test("eklenti kendi boyunda kalır, negatif dış boşlukla kutudan taşmaz", () => {
    expect(addons).toHaveLength(2)
    for (const addon of addons) {
      const addonClasses = classes(addon)
      expect(addonClasses).toContain("shrink-0")
      const negativeMargin = addonClasses.filter((cls) => /^-m[lrxse]?-|^m[lrxse]?-\[-/.test(utilityCore(cls)))
      expect(negativeMargin).toEqual([])
    }
    const [start, end] = addons.map(classes)
    expect(start).toContain("has-[>button]:pl-1")
    expect(end).toContain("has-[>button]:pr-1")
  })
})

describe("Combobox popup'ı grubun kutusuna çapalanır (#887)", () => {
  type GroupElement = ReactElement<{
    render: ReactElement<{ size?: string; className?: string }>
    onMouseDown?: (event: { preventBaseUIHandler: () => void }) => void
  }>

  test("ComboboxInput kabı Base UI Combobox.InputGroup + InputGroup'tur", () => {
    // Düz fonksiyon çağrısı yalnız ComboboxInput hook'suz olduğu için geçerli; hook eklenirse bu test render'a geçmeli.
    const element: GroupElement = ComboboxInput({ size: "compact", className: "w-full" })
    expect(element.type).toBe(ComboboxPrimitive.InputGroup)
    expect(element.props.render.type).toBe(InputGroup)
    expect(element.props.render.props.size).toBe("compact")
    expect(element.props.render.props.className).toBe("w-full")

    // Tek grup kutusu: InputGroup Base UI parçası olarak render edilir, iç içe sarılmaz.
    const html = renderToStaticMarkup(h(Combobox, { items: [] }, h(ComboboxInput, { size: "sm" })))
    const groups = tagsOf(html, "div").filter((tag) => attr(tag, "data-slot") === "input-group")
    expect(groups).toHaveLength(1)
    expect(attr(groups[0], "data-size")).toBe("sm")
  })

  test("devre dışı / salt okunur girdide gruba basış Base UI'a bırakılmaz (liste açılmaz)", () => {
    for (const props of [{ disabled: true }, { readOnly: true }]) {
      let prevented = false
      const element: GroupElement = ComboboxInput(props)
      element.props.onMouseDown?.({ preventBaseUIHandler: () => { prevented = true } })
      expect(prevented).toBe(true)
    }
    const enabled: GroupElement = ComboboxInput({})
    expect(enabled.props.onMouseDown).toBeUndefined()
  })

  test("popup genişliği çapanın genişliğidir; girdi çapası telafisi yok", () => {
    const source = readFileSync(fileURLToPath(new URL("./combobox.tsx", import.meta.url)), "utf8")
    const popup = source.match(/"group\/combobox-content [^"]*"/)?.[0].slice(1, -1).split(/\s+/) ?? []
    expect(popup).toContain("w-(--anchor-width)")
    expect(popup).toContain("max-w-(--available-width)")
    expect(popup.filter((cls) => cls.startsWith("min-w-"))).toEqual([])
    expect(source).not.toContain("data-chips")
  })

  test("chip'li çoklu seçimin popup'ı chip kabına çapalanır", () => {
    const SRC = fileURLToPath(new URL("../../", import.meta.url))
    const offenders: string[] = []
    eachTsx(SRC, (path, source) => {
      if (path.includes(`${sep}components${sep}ui${sep}`) || !source.includes("<ComboboxChips")) return
      if (!/<ComboboxChips\b[^>]*\bref=\{(\w+)\}[\s\S]*<ComboboxContent\b[^>]*\banchor=\{\1\}/.test(source)) {
        offenders.push(relative(SRC, path).split(sep).join("/"))
      }
    })
    expect(offenders).toEqual([])
  })
})

describe("dar hücredeki Combobox listesi okunur genişlikte açılabilir (#927)", () => {
  type ContentElement = ReactElement<{ children: ReactElement<{ children: ReactElement<{ className?: string }> }> }>
  const popupClasses = (element: ContentElement) =>
    (element.props.children.props.children.props.className ?? "").split(/\s+/)

  test('minWidth="menu" listeye en az genişlik verir (ekrana sığdırılarak); varsayılan çapanın genişliğidir', () => {
    // Düz fonksiyon çağrısı yalnız ComboboxContent hook'suz olduğu için geçerli.
    const menu = popupClasses(ComboboxContent({ minWidth: "menu" }))
    expect(menu).toContain("w-(--anchor-width)")
    expect(menu).toContain("min-w-[min(--spacing(56),var(--available-width))]")

    const anchor = popupClasses(ComboboxContent({}))
    expect(anchor).toContain("w-(--anchor-width)")
    expect(anchor.filter((cls) => cls.startsWith("min-w-"))).toEqual([])
  })
})
