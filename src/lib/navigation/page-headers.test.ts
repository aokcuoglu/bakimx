import { describe, expect, test } from "bun:test"
import { existsSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { FEATURE_CATALOG } from "@/lib/feature-catalog"
import { isSidebarlessRoute } from "@/lib/sidebarless-route"
import { NAV_GROUPS } from "./app-nav"
import {
  PAGE_HEADERS,
  SUB_PAGE_HEADERS,
  UNFRAMED_STATIC_ROUTES,
  hasPageHeader,
  matchSubPage,
  resolvePageHeader,
} from "./page-headers"

const ALL = { enabledFeatures: ["quotes", "appointments", "automatedReminders", "ocrIntake", "partsInventory", "procurement", "cashbox", "analytics", "reports", "communications", "team"] as const, actor: { role: "owner" as const } }

describe("page-headers (#823)", () => {
  test("her menü yolu kayıtlı", () => {
    const hrefs = NAV_GROUPS.flatMap((g) => g.items.flatMap((i) => [i.href, ...(i.children ?? []).map((c) => c.href)]))
    expect(hrefs.filter((h) => !hasPageHeader(h))).toEqual([])
    expect(Object.keys(PAGE_HEADERS).sort()).toEqual([...hrefs].sort())
  })
  test("Teknisyen Paneli: başlık ve iki düğme yalnız masaüstünde, kabul panel akışında", () => {
    const h = resolvePageHeader("/technician", ALL)!
    expect(h.title).toBe("Teknisyen Paneli")
    expect(h.desktopActionsOnly).toBe(true)
    expect(h.primaryAction?.label).toBe("Araç Kabul")
    const link = new URL(h.primaryAction!.href, "http://x")
    expect(isSidebarlessRoute(link.pathname, link.searchParams)).toBe(true)
    expect(h.secondaryActions.map((a) => a.href)).toEqual(["/technician/parts"])
  })
  test("üst seviye: Bölüm › Sayfa, bölüm bağlantısız", () => {
    const h = resolvePageHeader("/orders", ALL)!
    expect(h.crumbs).toEqual([{ label: "Servis" }, { label: "Araç Kabulleri" }])
    expect(h.title).toBe("Araç Kabulleri")
    const link = new URL(h.primaryAction!.href, "http://x")
    expect(link.pathname).toBe("/orders/new")
    expect(link.searchParams.get("entry")).toBe("plate")
    expect(link.searchParams.get("back")).toBe("/orders")
  })
  test("Genel Bakış Yeni Araç Kabul düğmesi Genel Bakış'a döner (#842)", () => {
    const link = new URL(resolvePageHeader("/dashboard", ALL)!.primaryAction!.href, "http://x")
    expect(link.pathname).toBe("/orders/new")
    expect(link.searchParams.get("entry")).toBe("plate")
    expect(link.searchParams.get("back")).toBe("/dashboard")
  })
  test("menü alt öğesi: üç halka, ara halka bağlantı", () => {
    expect(resolvePageHeader("/cashbox/payments", ALL)!.crumbs).toEqual([
      { label: "Depo & Finans" }, { label: "Kasa", href: "/cashbox" }, { label: "Tahsilatlar" },
    ])
  })
  test("başlık geçersiz kılma ve sabit açıklama", () => {
    const h = resolvePageHeader("/cashbox/aging", ALL)!
    expect(h.title).toBe("Yaşlandırma Raporu")
    expect(h.description).toBe("Müşteri alacaklarının vade gruplarına göre dağılımı")
  })
  test("birincil düğme ayrı, ikinciller sırasıyla", () => {
    const h = resolvePageHeader("/customers", ALL)!
    expect(h.primaryAction?.label).toBe("Yeni Müşteri")
    expect(h.secondaryActions.map((a) => a.label)).toEqual(["Bakiye Özeti"])
  })
  test("rotanın paketi yoksa (yükseltme ekranı) başlık var, düğme yok", () => {
    const h = resolvePageHeader("/quotes", { enabledFeatures: [], actor: { role: "owner" } })!
    expect(h.title).toBe("Teklifler")
    expect(h.primaryAction).toBeUndefined()
    expect(h.secondaryActions).toEqual([])
  })
  test("yetkisi olmayan ekip üyesi birincil düğmeyi görmez; kimliksiz kapı kapalı", () => {
    expect(resolvePageHeader("/orders", { ...ALL, actor: { role: "manager", teamPermissions: [] } })!.primaryAction).toBeUndefined()
    expect(resolvePageHeader("/orders", { ...ALL, actor: null })!.primaryAction).toBeUndefined()
  })
  test("kayıtsız yollar null: kabul akışı, teknisyen, ayarlar", () => {
    for (const p of ["/orders/new", "/technician", "/settings/general", "/reports/orders"]) {
      expect(resolvePageHeader(p, ALL)).toBeNull()
    }
  })
  test("menü sayfalarında telefon geri bağlantısı yok", () => {
    for (const href of Object.keys(PAGE_HEADERS)) {
      const h = resolvePageHeader(href, ALL)!
      expect(h.back).toBeNull()
      expect(h.titleMode).toBe("static")
    }
  })
  test("Genel Bakış tur çapaları korunur", () => {
    const h = resolvePageHeader("/dashboard", ALL)!
    expect(h.crumbs).toEqual([{ label: "Ana Panel" }, { label: "Genel Bakış" }])
    expect(h.tourId).toBe("welcome-banner")
    expect(h.primaryAction?.tourId).toBe("welcome-cta")
    expect(h.dynamicSubtitle).toBe(true)
  })
})

const APP_DIR = join(import.meta.dir, "..", "..", "app", "(app)")

/** `src/app/(app)` altındaki her `page.tsx`'in yolu, Next klasör sözdizimiyle. */
function appRoutes(dir = APP_DIR, prefix = ""): string[] {
  const routes: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (!statSync(full).isDirectory()) {
      if (name === "page.tsx") routes.push(prefix || "/")
      continue
    }
    if (name.startsWith("@") || name.startsWith("_")) continue
    const segment = name.startsWith("(") && name.endsWith(")") ? "" : `/${name}`
    routes.push(...appRoutes(full, `${prefix}${segment}`))
  }
  return routes
}

describe("alt sayfa başlıkları (#855)", () => {
  test("detay yükleniyor: zincir bilinen son bağlantıda biter, başlık boş, geri hazır", () => {
    const h = resolvePageHeader("/customers/c1", ALL)!
    expect(h.crumbs).toEqual([{ label: "Servis" }, { label: "Müşteriler", href: "/customers" }])
    expect(h.title).toBe("")
    expect(h.titleMode).toBe("record")
    expect(h.back).toEqual({ label: "Müşteriler", href: "/customers" })
    expect(h.description).toBeUndefined()
    expect(h.dynamicSubtitle).toBe(false)
  })
  test("detay yüklendi: kayıt adı son halka ve başlık", () => {
    const h = resolvePageHeader("/customers/c1", ALL, { recordTitle: "Ahmet Yılmaz" })!
    expect(h.crumbs).toEqual([
      { label: "Servis" },
      { label: "Müşteriler", href: "/customers" },
      { label: "Ahmet Yılmaz" },
    ])
    expect(h.title).toBe("Ahmet Yılmaz")
    expect(h.titleMode).toBe("record")
    expect(h.back).toEqual({ label: "Müşteriler", href: "/customers" })
  })
  test("boş kayıt adı bilinmiyor sayılır", () => {
    const h = resolvePageHeader("/quotes/q1", ALL, { recordTitle: "" })!
    expect(h.crumbs).toEqual([{ label: "Servis" }, { label: "Teklifler", href: "/quotes" }])
    expect(h.title).toBe("")
  })
  test("düzenleme yükleniyor: kayıt halkası ve yaprak yok, sabit başlık, geri kayda", () => {
    const h = resolvePageHeader("/vehicles/v1/edit", ALL)!
    expect(h.crumbs).toEqual([{ label: "Servis" }, { label: "Araçlar", href: "/vehicles" }])
    expect(h.title).toBe("Aracı Düzenle")
    expect(h.titleMode).toBe("static")
    expect(h.back).toEqual({ label: "Araç Detayı", href: "/vehicles/v1" })
  })
  test("düzenleme yüklendi: kayıt halkası bağlantı, yaprak Düzenle, geri değişmez", () => {
    const h = resolvePageHeader("/vehicles/v1/edit", ALL, { recordTitle: "34 ABC 123" })!
    expect(h.crumbs).toEqual([
      { label: "Servis" },
      { label: "Araçlar", href: "/vehicles" },
      { label: "34 ABC 123", href: "/vehicles/v1" },
      { label: "Düzenle" },
    ])
    expect(h.title).toBe("Aracı Düzenle")
    expect(h.back).toEqual({ label: "Araç Detayı", href: "/vehicles/v1" })
  })
  test("hatırlatma düzenleme: menü başlığı üst halka, alt satır sayfadan", () => {
    const h = resolvePageHeader("/reminders/r1/edit", ALL, { recordTitle: "Yağ bakımı" })!
    expect(h.crumbs).toEqual([
      { label: "Servis" },
      { label: "Bakım Hatırlatmaları", href: "/reminders" },
      { label: "Yağ bakımı", href: "/reminders/r1" },
      { label: "Düzenle" },
    ])
    expect(h.title).toBe("Hatırlatmayı Düzenle")
    expect(h.dynamicSubtitle).toBe(true)
    expect(h.back).toEqual({ label: "Hatırlatma Detayı", href: "/reminders/r1" })
    expect(resolvePageHeader("/reminders/r1", ALL)!.back).toEqual({
      label: "Bakım Hatırlatmaları",
      href: "/reminders",
    })
  })
  test("yeni kayıt sayfaları: sabit halka ve açıklama, kayıt adı yok sayılır", () => {
    const h = resolvePageHeader("/customers/new", ALL, { recordTitle: "yok sayılır" })!
    expect(h.crumbs).toEqual([
      { label: "Servis" },
      { label: "Müşteriler", href: "/customers" },
      { label: "Yeni Müşteri" },
    ])
    expect(h.title).toBe("Yeni Müşteri")
    expect(h.titleMode).toBe("static")
    expect(h.description).toBe("Bireysel veya kurumsal müşteri bilgilerini girin")
    expect(h.back).toEqual({ label: "Müşteriler", href: "/customers" })
    expect(resolvePageHeader("/vehicles/new", ALL)!.crumbs.at(-1)).toEqual({ label: "Yeni Araç" })
    expect(resolvePageHeader("/quotes/new", ALL)!.description).toBeUndefined()
  })
  test("kilitli özelliğin detay bağlantısı: ödeme duvarı özellik adını başlık yapar", () => {
    const locked = { enabledFeatures: [] as const, actor: { role: "owner" as const } }
    for (const [path, feature] of [
      ["/quotes/q1", "quotes"],
      ["/appointments/a1", "appointments"],
      ["/reminders/r1", "automatedReminders"],
    ] as const) {
      const name = FEATURE_CATALOG[feature].name
      const h = resolvePageHeader(path, locked, { recordTitle: name })!
      expect(h.title).toBe(name)
      expect(h.crumbs.at(-1)).toEqual({ label: name })
      expect(h.primaryAction).toBeUndefined()
    }
  })
  test("#883: teknisyen kısıtlı rolü erişemediği listeye değil Teknisyen Paneli'ne döner", () => {
    for (const role of ["usta", "cirak", "staff"] as const) {
      for (const [path, title] of [
        ["/quotes/new", "Yeni Teklif"],
        ["/appointments/new", "Yeni Randevu"],
        ["/reminders/new", "Yeni Hatırlatma"],
      ] as const) {
        const h = resolvePageHeader(path, { ...ALL, actor: { role } })!
        expect(h.back).toEqual({ label: "Teknisyen Paneli", href: "/technician" })
        expect(h.crumbs).toEqual([{ label: "Teknisyen Paneli", href: "/technician" }, { label: title }])
      }
    }
  })
  test("#883: ofis rolleri ve aktörsüz bağlam değişmez", () => {
    for (const actor of [{ role: "owner" as const }, { role: "manager" as const }, null]) {
      const h = resolvePageHeader("/quotes/new", { ...ALL, actor })!
      expect(h.back).toEqual({ label: "Teklifler", href: "/quotes" })
      expect(h.crumbs.at(-2)).toEqual({ label: "Teklifler", href: "/quotes" })
    }
  })
  test("alt sayfalar düğme taşımaz (tüm paketler açıkken bile)", () => {
    for (const pattern of Object.keys(SUB_PAGE_HEADERS)) {
      const h = resolvePageHeader(pattern.replaceAll("[id]", "x1"), ALL, { recordTitle: "Kayıt" })!
      expect(h.primaryAction).toBeUndefined()
      expect(h.secondaryActions).toEqual([])
    }
  })
  test("statik yol dinamik desenden önce gelir; kayıtsız alt yollar null", () => {
    expect(matchSubPage("/vehicles/new")).toEqual({ pattern: "/vehicles/new" })
    expect(matchSubPage("/vehicles/v1")).toEqual({ pattern: "/vehicles/[id]" })
    expect(matchSubPage("/vehicles/v1/edit")).toEqual({ pattern: "/vehicles/[id]/edit" })
    for (const p of [
      "/customers/balances",
      "/vehicles/v1/passport",
      "/orders/new",
      "/orders/o1",
      "/technician/orders/x",
      "/customers/a/b",
      "/customers/",
    ]) {
      expect(matchSubPage(p)).toBeNull()
      expect(hasPageHeader(p)).toBe(false)
      expect(resolvePageHeader(p, ALL)).toBeNull()
    }
  })
  test("kayıt bütünlüğü: üst var, dinamik üstün geri etiketi var, sayfa dosyası var", () => {
    const problems: string[] = []
    for (const [pattern, config] of Object.entries(SUB_PAGE_HEADERS)) {
      const parentIsMenu = Object.hasOwn(PAGE_HEADERS, config.parent)
      const parentSub = SUB_PAGE_HEADERS[config.parent]
      if (!parentIsMenu && !parentSub) problems.push(`${pattern}: üst ${config.parent} kayıtlı değil`)
      if (parentSub && !parentSub.backLabel) problems.push(`${pattern}: üst ${config.parent} backLabel vermiyor`)
      if (parentSub && !pattern.startsWith(`${config.parent}/`)) problems.push(`${pattern}: üstünün altında değil`)
      if (parentSub && !parentSub.title && !config.title) problems.push(`${pattern}: iki kayıt adı gerekir`)
      if (!existsSync(join(APP_DIR, pattern, "page.tsx"))) problems.push(`${pattern}: page.tsx yok`)
      if (Object.hasOwn(PAGE_HEADERS, pattern)) problems.push(`${pattern}: menü kaydıyla çakışıyor`)
    }
    for (const route of UNFRAMED_STATIC_ROUTES) {
      if (!existsSync(join(APP_DIR, route, "page.tsx"))) problems.push(`${route}: page.tsx yok`)
    }
    expect(problems).toEqual([])
  })
  test("her sayfa yalnız kendi desenine düşer (dinamik desen statik kardeşi yutmaz)", () => {
    const routes = appRoutes()
    expect(routes).toContain("/customers/[id]")
    expect(routes).toContain("/customers/balances")
    const captured = routes
      .map((route) => [route, matchSubPage(route)?.pattern] as const)
      .filter(([route, pattern]) => pattern !== undefined && pattern !== route)
    expect(captured).toEqual([])
  })
  // /technician telefonda sidebar'sız kiosktur ama lg+ tam kabukla ve PageFrame
  // başlığıyla çizilir (#1046); başka hiçbir kayıtlı yol sidebar'sız olmaz.
  test("/technician dışında kayıtlı hiçbir yol sidebar'sız değil (?from=technician dahil)", () => {
    const fromTechnician = new URLSearchParams("from=technician")
    const paths = [...Object.keys(PAGE_HEADERS), ...Object.keys(SUB_PAGE_HEADERS)].map((p) => p.replaceAll("[id]", "x1"))
      .filter((p) => p !== "/technician")
    expect(paths.filter((p) => isSidebarlessRoute(p, fromTechnician))).toEqual([])
  })
})
