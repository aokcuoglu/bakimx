import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { EmailAddress, emailAddressHtml } from "./email-address"

const ROOT = join(import.meta.dir, "../../..")

/** `mailto:`, `{COMPANY.email}` / `{COMPANY.kep}` ya da düz metin bir adres. */
const RAW_EMAIL_RENDER = /mailto:|\{COMPANY\.(email|kep)\}|[\w.+-]+@[\w-]+\.[a-z]{2,}/

/**
 * Public (Cloudflare arkasındaki, oturumsuz) yüzeyde e-posta basan dosyalar.
 * Buradaki her adres `EmailAddress`'ten geçmeli — aksi hâlde Cloudflare Email
 * Obfuscation açıkken sayfa React #418 ile hydrate olur (#735).
 */
const PUBLIC_EMAIL_SURFACES = [
  "src/components/sections/Footer.tsx",
  "src/components/sections/ContactPage.tsx",
  "src/app/privacy/page.tsx",
  "src/app/kvkk/page.tsx",
  "src/app/terms/page.tsx",
  "src/app/acik-riza/page.tsx",
]

describe("EmailAddress (#735 Cloudflare email obfuscation)", () => {
  test("wraps the address in Cloudflare's email_off markers", () => {
    expect(emailAddressHtml("hey@bakimx.com", true)).toBe(
      '<!--email_off--><a href="mailto:hey@bakimx.com">hey@bakimx.com</a><!--/email_off-->',
    )
    expect(emailAddressHtml("hey@bakimx.com", false)).toBe("<!--email_off-->hey@bakimx.com<!--/email_off-->")
  })

  test("server markup keeps the readable address and the comments", () => {
    const html = renderToStaticMarkup(createElement(EmailAddress, { address: "hey@bakimx.com" }))
    expect(html).toContain("<!--email_off-->")
    expect(html).toContain('href="mailto:hey@bakimx.com"')
    expect(html).toContain(">hey@bakimx.com</a>")
  })

  test("escapes HTML so the raw-HTML path cannot inject markup", () => {
    const html = emailAddressHtml('x"><img src=x onerror=alert(1)>@a.co', true)
    expect(html).not.toContain("<img")
    expect(html).toContain("&lt;img")
    expect(html).toContain("&quot;")
  })

  test.each(PUBLIC_EMAIL_SURFACES)("%s renders no raw email or mailto outside EmailAddress", (file) => {
    const source = readFileSync(join(ROOT, file), "utf8")
    const offending = source
      .split("\n")
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter(({ line }) => !line.startsWith("//") && !line.startsWith("*") && !line.includes("<EmailAddress"))
      .filter(({ line }) => !line.includes("placeholder="))
      .filter(({ line }) => RAW_EMAIL_RENDER.test(line))
      .map(({ line, number }) => `${file}:${number}: ${line}`)
    expect(offending).toEqual([])
  })

  test("the scan catches the pattern that caused #735", () => {
    // Footer'daki asıl satır bir JSX devam satırıydı; `>` ile başlamıyordu.
    expect(RAW_EMAIL_RENDER.test("onaylıyorum. İznimi dilediğim zaman abonelikten çıkarak veya hey@bakimx.com üzerinden")).toBe(true)
    expect(RAW_EMAIL_RENDER.test('<a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>')).toBe(true)
    expect(RAW_EMAIL_RENDER.test("<strong>{COMPANY.kep}</strong>")).toBe(true)
    expect(RAW_EMAIL_RENDER.test('import { EmailAddress } from "@/components/shared/email-address"')).toBe(false)
  })
})
