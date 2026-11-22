import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { SignupDialogProvider, SignupTrigger } from "./signup-dialog"

const inProvider = (child: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(createElement(SignupDialogProvider, null, child))

test("tetikleyici JS'siz /register'a giden gerçek bağlantıdır", () => {
  const html = inProvider(createElement(SignupTrigger, { variant: "pill", location: "hero_primary" }, "Ücretsiz deneyin"))
  expect(html).toContain('href="/register"')
  expect(html).not.toContain("<button")
})

test("metin tetikleyici › ile biter", () => {
  const html = inProvider(createElement(SignupTrigger, { variant: "text", location: "move_secondary" }, "Ücretsiz deneyin"))
  expect(html).toContain("Ücretsiz deneyin ›")
})

test("kayıt hızlı akışla, onaya bağlı ilişkilendirmeyle ve kilitle gönderilir", () => {
  const source = readFileSync(join(import.meta.dir, "signup-dialog.tsx"), "utf8")
  expect(source).toContain('signupFlow: "quick"')
  expect(source).toContain("getStoredMarketingAttribution()")
  expect(source).toContain("if (submitRef.current) return")
  expect(source).toContain('"register_submitted"')
  expect(source.indexOf("if (!data.ok)")).toBeLessThan(source.indexOf('"register_submitted"'))
})
