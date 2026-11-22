import { expect, test } from "bun:test"
import { createElement, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PillButton } from "./pill-button"
import { RoundIconButton } from "./round-icon-button"
import { TextLink } from "./text-link"
import { Wordmark } from "./wordmark"

const render = (element: ReactElement) => renderToStaticMarkup(element)

test("PillButton href ile tek bir bağlantı üretir, iç içe düğme yok", () => {
  const html = render(createElement(PillButton, { href: "/register" }, "Ücretsiz deneyin"))
  expect(html).toContain('href="/register"')
  expect(html).not.toContain("<button")
  expect(html).toContain("Ücretsiz deneyin")
})

test("PillButton href olmadan gerçek bir düğmedir", () => {
  const html = render(createElement(PillButton, { type: "submit", size: "lg" }, "Beni arayın"))
  expect(html).toContain("<button")
  expect(html).toContain('type="submit"')
})

test("TextLink sona › ekler", () => {
  expect(render(createElement(TextLink, { href: "/demo" }, "Sizi arayalım"))).toContain("Sizi arayalım ›")
})

test("RoundIconButton erişilebilir ad taşır", () => {
  expect(render(createElement(RoundIconButton, { label: "Önceki kart" }, "‹"))).toContain('aria-label="Önceki kart"')
})

test("Wordmark başa dönüş etiketi ve X logosu", () => {
  const html = render(createElement(Wordmark, { variant: "header", href: "#hero" }))
  expect(html).toContain('aria-label="BakımX, başa dön"')
  expect(html).toContain("bakimx-x.svg")
  expect(html).toContain("Bakım")
})
