import { expect, test } from "bun:test"
import { createElement, type ReactElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { CheckList } from "./check-list"
import { FaqAccordion } from "./faq-accordion"
import { FeatureTile } from "./feature-tile"
import { NumberedSteps } from "./numbered-steps"
import { PhotoCard } from "./photo-card"
import { PhotoRail } from "./photo-rail"
import { PriceBlock } from "./price-block"

const render = (element: ReactElement) => renderToStaticMarkup(element)

test("NumberedSteps sıralı liste ve her adım", () => {
  const html = render(createElement(NumberedSteps, {
    steps: [{ title: "A", text: "a" }, { title: "B", text: "b" }, { title: "C", text: "c" }],
  }))
  expect(html).toContain("<ol")
  expect(html.match(/<li/g)).toHaveLength(3)
})

test("PriceBlock tutar, birim ve başlık bağlantısı", () => {
  const html = render(createElement(PriceBlock, {
    titleId: "fiyat-t", title: "Tek paket, her zaman.", subtitle: "s", amount: "₺1.499",
    unit: "/ ay, KDV dahil", items: ["x"], cta: null, note: "Kart bilgisi istenmez.",
  }))
  expect(html).toContain("₺1.499")
  expect(html).toContain("/ ay, KDV dahil")
  expect(html).toContain('id="fiyat-t"')
  expect(html).toContain("Kart bilgisi istenmez.")
})

test("CheckList her maddeyi listeler", () => {
  const html = render(createElement(CheckList, { items: ["Bir", "İki", "Üç"] }))
  expect(html.match(/<li/g)).toHaveLength(3)
})

test("FaqAccordion her soruyu kapalı tetikleyici olarak basar", () => {
  const html = render(createElement(FaqAccordion, {
    items: [{ question: "Q1", answer: "A1" }, { question: "Q2", answer: "A2" }],
  }))
  expect(html.match(/aria-expanded="false"/g)).toHaveLength(2)
  expect(html).toContain("Q1")
})

test("PhotoRail kaydırılabilir bölgeyi başlığa bağlar ve ok düğmeleri adlıdır", () => {
  const html = render(createElement(PhotoRail, { title: "T", titleId: "nasil-t" }, null))
  expect(html).toContain('role="region"')
  expect(html).toContain('aria-labelledby="nasil-t"')
  expect(html).toContain('tabindex="0"')
  expect(html).toContain('aria-label="Önceki kart"')
  expect(html).toContain('aria-label="Sonraki kart"')
})

test("PhotoCard etiket, açıklama ve alt metin", () => {
  const html = render(createElement(PhotoCard, { src: "/landing/esantral/kabul.webp", alt: "Usta fotoğraf çekiyor", label: "Araç Kabul" }, "Açıklama"))
  expect(html).toContain('alt="Usta fotoğraf çekiyor"')
  expect(html).toContain("Araç Kabul")
  expect(html).toContain("Açıklama")
})

test("FeatureTile başlık seviyesi h3", () => {
  const html = render(createElement(FeatureTile, { icon: null, title: "Araç geçmişi" }, "Plakayı yazın"))
  expect(html).toContain("<h3")
  expect(html).toContain("Plakayı yazın")
})
