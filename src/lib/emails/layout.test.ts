import { expect, test } from "bun:test"
import { renderEmailLayout } from "./layout"

test("renderEmailLayout heading, gövde ve CTA linkini içerir", () => {
  const html = renderEmailLayout({
    heading: "Hoş geldiniz",
    bodyHtml: "<p>Test gövde</p>",
    cta: { label: "Giriş Yap", url: "https://app.bakimx.com/login" },
  })
  expect(html).toContain("Hoş geldiniz")
  expect(html).toContain("Test gövde")
  expect(html).toContain("https://app.bakimx.com/login")
  expect(html).toContain("Giriş Yap")
  expect(html).toContain("BakimX")
})

test("renderEmailLayout CTA verilmezse link içermez", () => {
  const html = renderEmailLayout({ heading: "Bilgi", bodyHtml: "<p>x</p>" })
  expect(html).not.toContain("href=")
})
