import { expect, test } from "bun:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { CallbackDialogProvider, CallbackTrigger } from "./callback-dialog"

test("metin tetikleyici JS'siz /demo'ya giden gerçek bağlantıdır", () => {
  const html = renderToStaticMarkup(createElement(
    CallbackDialogProvider,
    null,
    createElement(CallbackTrigger, { variant: "text", location: "hero_secondary" }, "Sizi arayalım"),
  ))
  expect(html).toContain('href="/demo"')
  expect(html).toContain("Sizi arayalım ›")
})

test("büyük hap tetikleyici de /demo'ya düşer ve iç içe düğme üretmez", () => {
  const html = renderToStaticMarkup(createElement(
    CallbackDialogProvider,
    null,
    createElement(CallbackTrigger, { variant: "pill-lg", location: "move_primary" }, "Sizi arayalım"),
  ))
  expect(html).toContain('href="/demo"')
  expect(html).not.toContain("<button")
})

test("sağlayıcı olmadan da tetikleyici bağlantı olarak çalışır", () => {
  const html = renderToStaticMarkup(createElement(CallbackTrigger, { variant: "pill", location: "x" }, "Sizi arayalım"))
  expect(html).toContain('href="/demo"')
})
