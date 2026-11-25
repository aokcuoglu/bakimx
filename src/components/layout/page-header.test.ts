import { describe, expect, test } from "bun:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Plus, Wallet } from "lucide-react"
import type { ResolvedPageHeader } from "@/lib/navigation/page-headers"
import { PageHeaderView } from "./page-header"

const base: ResolvedPageHeader = {
  crumbs: [{ label: "Servis" }, { label: "Kasa", href: "/cashbox" }, { label: "Tahsilatlar" }],
  title: "Tahsilatlar",
  dynamicSubtitle: false,
  secondaryActions: [],
}

function render(header: Partial<ResolvedPageHeader>, subtitle?: string) {
  return renderToStaticMarkup(createElement(PageHeaderView, { header: { ...base, ...header }, subtitle }))
}

describe("PageHeaderView", () => {
  test("breadcrumb: last crumb is the current page, group label is not a link", () => {
    const html = render({})
    expect(html).toContain('aria-current="page"')
    expect(html).toContain('href="/cashbox"')
    expect(html).toContain('aria-label="Sayfa yolu"')
    expect(html).not.toMatch(/<li[^>]*>(?:(?!<\/li>).)*<li/)
    expect(html).not.toMatch(/<a[^>]*>Servis/)
  })

  test("title is an h1", () => {
    expect(render({})).toMatch(/<h1[^>]*>Tahsilatlar<\/h1>/)
  })

  test("menu page: breadcrumb at every width, no back link (#855)", () => {
    const html = render({ back: null })
    expect(html).toContain('data-slot="page-trail"')
    expect(html).not.toContain('data-slot="page-back"')
    expect(html).not.toContain("data-has-back")
  })

  test("sub-page: back link rendered next to the breadcrumb (#855)", () => {
    const html = render({ back: { label: "Müşteriler", href: "/customers" } })
    expect(html).toContain("data-has-back")
    expect(html).toMatch(/data-slot="page-back"[^>]*>.*Geri: .*Müşteriler<\/span><\/a>/)
  })

  test("record title loading: h1 keeps its row with an aria-hidden NBSP (#855)", () => {
    const html = render({ title: "", titleMode: "record" })
    const tag = html.match(/<h1[^>]*>([^<]*)<\/h1>/)
    expect(tag?.[1]).toBe("\u00a0")
    expect(tag?.[0]).toContain('aria-hidden="true"')
    expect(tag?.[0]).toContain('data-slot="page-title"')
  })

  test("record title loaded: no aria-hidden, full name in title attr, clamp class (#855)", () => {
    const html = render({ title: "Ahmet Yılmaz", titleMode: "record" })
    const tag = html.match(/<h1[^>]*>/)?.[0] ?? ""
    expect(html).toMatch(/<h1[^>]*>Ahmet Yılmaz<\/h1>/)
    expect(tag).not.toContain("aria-hidden")
    expect(tag).toContain('title="Ahmet Yılmaz"')
    expect(render({ title: "", titleMode: "record" }).match(/<h1[^>]*>/)?.[0]).not.toContain("title=")
    expect(render({}).match(/<h1[^>]*>/)?.[0]).not.toContain("title=")
    const staticTag = render({}).match(/<h1[^>]*>/)?.[0] ?? ""
    const classes = (t: string) => new Set(t.match(/class="([^"]*)"/)?.[1].split(" "))
    expect([...classes(tag)].filter((c) => !classes(staticTag).has(c))).toHaveLength(1)
  })

  test("dynamic subtitle reserves an empty aria-hidden row until the page supplies text", () => {
    const empty = render({ dynamicSubtitle: true })
    expect(empty).toContain('data-slot="page-subtitle"')
    expect(empty).toMatch(/data-slot="page-subtitle"[^>]*aria-hidden="true"|aria-hidden="true"[^>]*data-slot="page-subtitle"/)
    const reserved = empty.match(/<p[^>]*data-slot="page-subtitle"[^>]*>([^<]*)<\/p>/)?.[1]
    expect(reserved).toBe("\u00a0")
    const filled = render({ dynamicSubtitle: true }, "3 kayıt")
    expect(filled).toContain("3 kayıt")
    const tag = filled.match(/<p[^>]*data-slot="page-subtitle"[^>]*>/)?.[0] ?? ""
    expect(tag).not.toBe("")
    expect(tag).not.toContain("aria-hidden")
  })

  test("empty-string subtitle counts as absent", () => {
    expect(render({}, "")).not.toContain("page-subtitle")
  })

  test("static description renders inside the subtitle slot", () => {
    const html = render({ description: "Açıklama metni" })
    expect(html).toMatch(/data-slot="page-subtitle"[^>]*>Açıklama metni/)
  })

  test("no subtitle slot without dynamicSubtitle or description", () => {
    expect(render({})).not.toContain("page-subtitle")
  })

  test("secondary actions come before the primary in DOM (focus order matches visual order at >=640)", () => {
    const html = render({
      primaryAction: { label: "Yeni Müşteri", href: "/customers/new", icon: Plus, primary: true },
      secondaryActions: [{ label: "Bakiye Özeti", href: "/customers/balances", icon: Wallet }],
    })
    expect(html.indexOf("Yeni Müşteri")).toBeGreaterThan(-1)
    expect(html.indexOf("Bakiye Özeti")).toBeLessThan(html.indexOf("Yeni Müşteri"))
  })

  test("tour anchors are emitted", () => {
    const html = render({
      tourId: "welcome-banner",
      primaryAction: { label: "Yeni", href: "/x", icon: Plus, primary: true, tourId: "welcome-cta" },
    })
    expect(html).toContain('data-tour="welcome-banner"')
    expect(html).toContain('data-tour="welcome-cta"')
  })
})
