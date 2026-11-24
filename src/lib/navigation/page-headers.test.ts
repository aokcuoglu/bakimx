import { describe, expect, test } from "bun:test"
import { NAV_GROUPS } from "./app-nav"
import { PAGE_HEADERS, hasPageHeader, resolvePageHeader } from "./page-headers"
import { NEW_INTAKE_HREF } from "@/lib/intake/entry-links"

const ALL = { enabledFeatures: ["quotes", "appointments", "automatedReminders", "ocrIntake", "partsInventory", "procurement", "cashbox", "analytics", "reports", "communications", "team"] as const, actor: { role: "owner" as const } }

describe("page-headers (#823)", () => {
  test("sidebar'sız /technician dışında her menü yolu kayıtlı", () => {
    const hrefs = NAV_GROUPS.flatMap((g) => g.items.flatMap((i) => [i.href, ...(i.children ?? []).map((c) => c.href)]))
      .filter((h) => h !== "/technician")
    expect(hrefs.filter((h) => !hasPageHeader(h))).toEqual([])
    expect(Object.keys(PAGE_HEADERS).sort()).toEqual([...hrefs].sort())
  })
  test("üst seviye: Bölüm › Sayfa, bölüm bağlantısız", () => {
    const h = resolvePageHeader("/orders", ALL)!
    expect(h.crumbs).toEqual([{ label: "Servis" }, { label: "Araç Kabulleri" }])
    expect(h.title).toBe("Araç Kabulleri")
    expect(h.primaryAction?.href).toBe(NEW_INTAKE_HREF)
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
  test("kayıtsız yollar null: alt sayfalar, teknisyen, ayarlar", () => {
    for (const p of ["/orders/new", "/customers/abc", "/technician", "/settings/general", "/reports/orders"]) {
      expect(resolvePageHeader(p, ALL)).toBeNull()
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
