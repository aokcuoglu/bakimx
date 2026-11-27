import { expect, test } from "bun:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { AddonGate, AddonLockedNote } from "./addon-gate"

test("kompakt not: satın alınabilen ek özellik Ayarlar → Paketler'e gider (#829)", () => {
  const html = renderToStaticMarkup(createElement(AddonLockedNote, { feature: "vinLookup" }))
  expect(html).toContain("VIN ile araç tanıma")
  expect(html).toContain("Ek özellik")
  expect(html).toContain("Satın al")
  expect(html).toContain('href="/settings/plans?addon=vinLookup#ayarlar-ek-ozellikler"')
  expect(html).not.toContain('target="_blank"')
  expect(html).not.toContain("wa.me")
  expect(html).not.toContain("yakında")
  // Rozet span'dır; not içinde blok öğe yok (p içinde div uyarısı çıkmasın).
  expect(html).not.toMatch(/<p[\s>]/)
})

test("kompakt not: parça kataloğu kapısı da şaseden parça satın almasına gider", () => {
  const html = renderToStaticMarkup(createElement(AddonLockedNote, { feature: "partsCatalog" }))
  expect(html).toContain("addon=vinLookup")
})

test("kompakt not: satılmayan ek özellik yeni sekmede açılan destek bağlantısında kalır (#828)", () => {
  const html = renderToStaticMarkup(createElement(AddonLockedNote, { feature: "multiBranch" }))
  expect(html).toContain("Bilgi alın")
  expect(html).toContain('target="_blank"')
  expect(html).toContain('rel="noopener noreferrer"')
  expect(html).toContain("https://wa.me/")
  expect(html).toContain("yeni sekmede açılır")
  expect(html).not.toContain("/settings/plans")
  // Rozet span'dır; not içinde blok öğe yok (p içinde div uyarısı çıkmasın).
  expect(html).not.toMatch(/<p[\s>]/)
})

test("eylem bağlantısı: bağlantı görünümlü düğme, telefonda 44px dokunma katmanı, yükseklik ezmesi yok", () => {
  const html = renderToStaticMarkup(createElement(AddonLockedNote, { feature: "ocrIntake" }))
  const link = html.match(/<a [^>]*>/)?.[0] ?? ""
  expect(link).toContain('data-variant="link"')
  expect(link).toContain("before:h-11")
  expect(link).toContain("before:inset-x-0")
  expect(link).toContain("md:before:hidden")
  // Görünür boy varyanttan gelir (docs/ui-control-sizing.md): çağrı yerinde h-* yok.
  expect(link).not.toMatch(/(?:^|\s|")h-(?!\()/)
})

test("AddonGate: açıkken çocuk, kapalıyken yöneticiye not, saha rolüne hiçbir şey", () => {
  const child = createElement("span", null, "GİRİŞ")
  const open = renderToStaticMarkup(createElement(AddonGate, { feature: "ocrIntake", enabled: true, showUpsell: true }, child))
  expect(open).toBe("<span>GİRİŞ</span>")
  const locked = renderToStaticMarkup(createElement(AddonGate, { feature: "ocrIntake", enabled: false, showUpsell: true }, child))
  expect(locked).toContain("Ruhsat OCR")
  expect(locked).not.toContain("GİRİŞ")
  const field = renderToStaticMarkup(createElement(AddonGate, { feature: "ocrIntake", enabled: false, showUpsell: false }, child))
  expect(field).toBe("")
})
