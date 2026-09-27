import { describe, expect, test } from "bun:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { HighlightCard } from "./highlight-card"
import { StatCard } from "./stat-card"

describe("summary cards", () => {
  test("filter cards retain their destination and announce the active filter", () => {
    const html = renderToStaticMarkup(createElement(HighlightCard, { label: "Aktif", value: 7, href: "/orders?status=active", active: true }))
    expect(html).toContain('href="/orders?status=active"')
    expect(html).toContain('aria-current="page"')
    expect(html).toContain('data-slot="highlight-card"')
  })
  test("plain cards are not fake interactive controls", () => {
    const html = renderToStaticMarkup(createElement(HighlightCard, { label: "Ekip", value: "Atanmadı" }))
    expect(html).not.toContain('<a ')
    expect(html).not.toContain('tabindex')
    expect(html).toContain('Atanmadı')
  })
  test("summary values are shown once; explicitly supplied badges are retained", () => {
    const html = renderToStaticMarkup(createElement(StatCard, { label: "Toplam", value: "₺123,45" }))
    expect(html.split('₺123,45')).toHaveLength(2)
    const badge = renderToStaticMarkup(createElement(StatCard, { label: "Toplam", value: "₺123,45", badge: "3 kayıt" }))
    expect(badge).toContain('3 kayıt')
  })
})
