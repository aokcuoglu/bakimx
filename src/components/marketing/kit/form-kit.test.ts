import { expect, test } from "bun:test"
import { createElement, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { FloatingField } from "./floating-field"
import { SuccessState } from "./success-state"

const render = (element: ReactElement) => renderToStaticMarkup(element)

test("FloatingField alan özniteliklerini Input'a geçirir", () => {
  const html = render(createElement(FloatingField, { label: "Ad soyad", id: "cb-name", "aria-invalid": true, name: "name" }))
  const input = html.match(/<input[^>]*>/)?.[0] ?? ""
  expect(input).toContain('id="cb-name"')
  expect(input).toContain('aria-invalid="true"')
  expect(input).toContain('placeholder=" "')
  expect(html).toContain("Ad soyad")
})

test("FloatingField yan öğe (ör. Göster) alanın yanında basılır", () => {
  const html = render(createElement(FloatingField, { label: "Şifre", trailing: createElement("span", null, "Göster") }))
  expect(html).toContain("Göster")
})

test("SuccessState başlığı ve Tamam düğmesi", () => {
  const html = render(createElement(SuccessState, { titleId: "t", title: "Teşekkürler.", text: "Alındı.", onDone: () => {} }))
  expect(html).toContain('id="t"')
  expect(html).toContain("Teşekkürler.")
  expect(html).toContain("Tamam")
})
