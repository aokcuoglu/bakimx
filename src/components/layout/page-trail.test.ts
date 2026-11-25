import { describe, expect, test } from "bun:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { PageTrail, type PageTrailProps } from "./page-trail"

function render(props: PageTrailProps) {
  return renderToStaticMarkup(createElement(PageTrail, props))
}

const menuCrumbs = [{ label: "Servis" }, { label: "Müşteriler" }] as const

describe("PageTrail (#855)", () => {
  test("geri bağlantısı yoksa yalnız breadcrumb (menü sayfası)", () => {
    const html = render({ crumbs: menuCrumbs })
    expect(html).toContain('data-slot="page-trail"')
    expect(html).toContain('aria-label="Sayfa yolu"')
    expect(html).not.toContain('data-slot="page-back"')
    expect(html).not.toContain("data-has-back")
    expect(html).toMatch(/aria-current="page"[^>]*>Müşteriler</)
  })

  test("geri bağlantısı breadcrumb ile birlikte DOM'da (genişliğe CSS karar verir)", () => {
    const html = render({
      crumbs: [{ label: "Servis" }, { label: "Müşteriler", href: "/customers" }, { label: "Ahmet Yılmaz" }],
      back: { label: "Müşteriler", href: "/customers" },
    })
    expect(html).toContain("data-has-back")
    expect(html).toContain('aria-label="Sayfa yolu"')
    const back = html.match(/<a[^>]*data-slot="page-back"[^>]*>(.*?)<\/a>/)
    expect(back).not.toBeNull()
    expect(back![0]).toContain('href="/customers"')
    expect(back![1]).toContain('aria-hidden="true"')
    expect(back![1]).toEndWith("Müşteriler")
  })

  test("yükleniyor: son halka bağlantıysa aria-current almaz", () => {
    const html = render({
      crumbs: [{ label: "Servis" }, { label: "Araçlar", href: "/vehicles" }],
      back: { label: "Araç", href: "/vehicles/v1" },
    })
    expect(html).not.toContain("aria-current")
    expect(html).toMatch(/<a[^>]*href="\/vehicles"[^>]*>Araçlar<\/a>/)
  })

  test("bölüm etiketi bağlantı değil, sayfa da değil", () => {
    const html = render({ crumbs: [{ label: "Servis" }, { label: "Müşteriler", href: "/customers" }, { label: "Ali" }] })
    expect(html).not.toMatch(/<a[^>]*>Servis/)
    expect(html).toMatch(/<span>Servis<\/span>/)
    expect(html).toMatch(/aria-current="page"[^>]*>Ali</)
  })

  test("yalnız en uzun halka kısalmaya işaretlenir (kayıt adı; düzenlemede bağlantı halkası)", () => {
    const html = render({
      crumbs: [
        { label: "Servis" },
        { label: "Araçlar", href: "/vehicles" },
        { label: "Çok Uzun Kurumsal Müşteri Adı", href: "/vehicles/v1" },
        { label: "Düzenle" },
      ],
    })
    expect(html.match(/data-shrink/g)).toHaveLength(1)
    expect(html).toMatch(/<li[^>]*data-shrink="true"[^>]*><a[^>]*href="\/vehicles\/v1"/)
  })

  test("className kök elemana eklenir", () => {
    expect(render({ crumbs: menuCrumbs, className: "ek-sinif" })).toMatch(/data-slot="page-trail"[^>]*class="[^"]*ek-sinif/)
  })
})
