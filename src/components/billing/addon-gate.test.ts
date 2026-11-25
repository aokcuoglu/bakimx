import { expect, test } from "bun:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { AddonGate, AddonLockedNote } from "./addon-gate"

test("kompakt not: ad, Ek özellik rozeti ve yeni sekmede açılan destek bağlantısı; açıklama cümlesi yok (#828)", () => {
  const html = renderToStaticMarkup(createElement(AddonLockedNote, { feature: "vinLookup" }))
  expect(html).toContain("VIN ile araç tanıma")
  expect(html).toContain("Ek özellik")
  expect(html).toContain("Bilgi alın")
  expect(html).toContain('target="_blank"')
  expect(html).toContain('rel="noopener noreferrer"')
  expect(html).toContain("https://wa.me/")
  expect(html).toContain("yeni sekmede açılır")
  // "yakında satın alınabilir" vaadi sayfa düzeyindeki kilitte kalır.
  expect(html).not.toContain("yakında")
  // Rozet span'dır; not içinde blok öğe yok (p içinde div uyarısı çıkmasın).
  expect(html).not.toMatch(/<p[\s>]/)
})

test("Bilgi alın: bağlantı görünümlü düğme, telefonda 44px dokunma katmanı, yükseklik ezmesi yok", () => {
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
