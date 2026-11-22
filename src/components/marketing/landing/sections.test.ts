import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { AppMockup } from "./app-mockup"
import { CallbackDialogProvider } from "./callback-dialog"
import { DayStrip } from "./day-strip"
import { Faq } from "./faq"
import { Features } from "./features"
import { FinalCta } from "./final-cta"
import { Hero } from "./hero"
import { LandingFooter } from "./landing-footer"
import { LandingHeader } from "./landing-header"
import { Move } from "./move"
import { Price } from "./price"

const render = (...children: ReactNode[]) =>
  renderToStaticMarkup(createElement(CallbackDialogProvider, null, ...children))

test("hero başlığı sunucu HTML'inde görünür ve gizli başlamaz", () => {
  const html = render(createElement(Hero))
  const h1 = html.match(/<h1[\s\S]*?<\/h1>/)?.[0] ?? ""
  expect(h1).toContain("Oto servisinizi")
  expect(h1).toContain("telefonunuzdan yönetin.")
  expect(html).not.toMatch(/opacity:\s*0/)
  expect(html).not.toContain('data-reveal="pending"')
  expect(html).toMatch(/fetchpriority="high"/i)
})

test("çapalar, CTA hedefleri ve yasal bağlantılar", () => {
  const html = render(createElement(LandingHeader), createElement(Price), createElement(LandingFooter))
  for (const href of ['href="#nasil"', 'href="#ozellikler"', 'href="#fiyat"', 'href="#sorular"', 'href="/login"', 'href="/register"', 'href="/kvkk"', 'href="/privacy"', 'href="/terms"']) {
    expect(html).toContain(href)
  }
  expect(html).toContain("₺1.499")
})

test("bölüm kimlikleri e-santral çapalarıyla aynı", () => {
  const html = render(createElement(Hero), createElement(DayStrip), createElement(Features), createElement(Move), createElement(Price), createElement(Faq), createElement(FinalCta))
  for (const id of ["hero", "nasil", "ozellikler", "gecis", "fiyat", "sorular"]) expect(html).toContain(`id="${id}"`)
  expect(html.match(/<h1/g)).toHaveLength(1)
})

test("son çağrı WhatsApp'ı yeni sekmede açar", () => {
  const html = render(createElement(FinalCta))
  expect(html).toMatch(/href="https:\/\/wa\.me\/\d+\?text=[^"]+"[^>]*target="_blank"|target="_blank"[^>]*href="https:\/\/wa\.me\//)
})

test("maket ekran okuyucuya tek görsel olarak sunulur", () => {
  const html = renderToStaticMarkup(createElement(AppMockup))
  expect(html).toContain('role="img"')
  expect(html).toContain('aria-hidden="true"')
  expect(html).toContain("Yıldız Oto Servis")
})

test("sayfa sıfırlamaları sıfır özgüllükte; kit sınıflarının margin/rengini ezmez", () => {
  // Görsel QA (22-11): `.page :where(p)` (0,1,0) `.priceSub`/`.tileTitle` margin'lerini ve
  // `.textLink` rengini dosya sırasına göre eziyordu — fiyat kutusu ve özellik kutuları çöktü.
  const css = readFileSync(join(import.meta.dir, "landing.module.css"), "utf8")
  expect(css).not.toMatch(/^\.page :where\(/m)
  expect(css).toContain(":where(.page) :where(h1, h2, h3, p)")
})

test("alt bant çerez tercihlerini yeniden açma düğmesini taşır", () => {
  // Eski ana sayfa footer'ında vardı; kaldırılırsa ziyaretçi çerez onayını geri alamaz (KVKK).
  const html = render(createElement(LandingFooter))
  expect(html).toContain("Çerez tercihleri")
})
