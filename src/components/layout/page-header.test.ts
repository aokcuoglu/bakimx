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
    expect(html).not.toMatch(/<a[^>]*>Servis/)
  })

  test("title is an h1", () => {
    expect(render({})).toMatch(/<h1[^>]*>Tahsilatlar<\/h1>/)
  })

  test("dynamic subtitle reserves an empty aria-hidden row until the page supplies text", () => {
    const empty = render({ dynamicSubtitle: true })
    expect(empty).toContain('data-slot="page-subtitle"')
    expect(empty).toContain('aria-hidden="true"')
    const filled = render({ dynamicSubtitle: true }, "3 kayıt")
    expect(filled).toContain("3 kayıt")
    expect(filled.slice(filled.indexOf('data-slot="page-subtitle"'))).not.toContain('aria-hidden="true"')
  })

  test("static description renders inside the subtitle slot", () => {
    const html = render({ description: "Açıklama metni" })
    expect(html).toMatch(/data-slot="page-subtitle"[^>]*>Açıklama metni/)
  })

  test("no subtitle slot without dynamicSubtitle or description", () => {
    expect(render({})).not.toContain("page-subtitle")
  })

  test("primary action comes before secondary actions", () => {
    const html = render({
      primaryAction: { label: "Yeni Müşteri", href: "/customers/new", icon: Plus, primary: true },
      secondaryActions: [{ label: "Bakiye Özeti", href: "/customers/balances", icon: Wallet }],
    })
    expect(html.indexOf("Yeni Müşteri")).toBeGreaterThan(-1)
    expect(html.indexOf("Yeni Müşteri")).toBeLessThan(html.indexOf("Bakiye Özeti"))
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
