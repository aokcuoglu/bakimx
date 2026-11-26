import { describe, expect, test } from "bun:test"
import {
  ORDER_SECTIONS,
  pickActiveSection,
  sectionForLegacyTab,
  sectionUrl,
} from "@/lib/orders/detail-sections"

describe("ORDER_SECTIONS (#911)", () => {
  test("altı bölüm, iş akışı sırasıyla", () => {
    expect(ORDER_SECTIONS.map((s) => s.id)).toEqual(["ozet", "kalemler", "kanit", "odeme", "teknisyen", "gecmis"])
    expect(ORDER_SECTIONS.map((s) => s.label)).toEqual(["Özet", "Kalemler", "Kanıt", "Ödeme", "Teknisyen", "Geçmiş"])
  })
})

describe("sectionForLegacyTab — eski ?tab= bağlantıları kırılmaz", () => {
  test("sekme anahtarları bölüme eşlenir", () => {
    expect(sectionForLegacyTab("parca")).toBe("kalemler")
    expect(sectionForLegacyTab("tahsilat")).toBe("odeme")
    expect(sectionForLegacyTab("kanit")).toBe("kanit")
    expect(sectionForLegacyTab("teknisyen")).toBe("teknisyen")
    expect(sectionForLegacyTab("gecmis")).toBe("gecmis")
  })

  test("Özet, bilinmeyen değer ve boş parametre kaydırmaz", () => {
    expect(sectionForLegacyTab("ozet")).toBeNull()
    expect(sectionForLegacyTab("parcalar")).toBeNull()
    expect(sectionForLegacyTab("constructor")).toBeNull()
    expect(sectionForLegacyTab("")).toBeNull()
    expect(sectionForLegacyTab(null)).toBeNull()
    expect(sectionForLegacyTab(undefined)).toBeNull()
  })
})

describe("sectionUrl", () => {
  test("tab ve edit düşer, returnTo korunur, hash bölüm olur", () => {
    const href = "https://app.test/orders/abc?tab=parca&edit=1&returnTo=%2Forders%3Fstatus%3Dopen"
    expect(sectionUrl(href, "kalemler")).toBe("/orders/abc?returnTo=%2Forders%3Fstatus%3Dopen#kalemler")
  })

  test("parametre yoksa yalnız yol + hash; eski hash değişir", () => {
    expect(sectionUrl("https://app.test/orders/abc", "kanit")).toBe("/orders/abc#kanit")
    expect(sectionUrl("https://app.test/orders/abc#ozet", "gecmis")).toBe("/orders/abc#gecmis")
  })
})

describe("pickActiveSection", () => {
  const tops = [
    { id: "ozet", top: -900 },
    { id: "kalemler", top: -200 },
    { id: "kanit", top: 300 },
    { id: "odeme", top: 1400 },
  ] as const

  test("çizgiyi geçen en alttaki bölüm etkindir", () => {
    expect(pickActiveSection(tops, 120)).toBe("kalemler")
    expect(pickActiveSection(tops, 300)).toBe("kanit")
  })

  test("8px tolerans: kaydırma bölümü tam çizgiye oturtunca o bölüm etkin", () => {
    expect(pickActiveSection([{ id: "ozet", top: 0 }, { id: "kanit", top: 127.5 }], 120)).toBe("kanit")
    expect(pickActiveSection([{ id: "ozet", top: 0 }, { id: "kanit", top: 129 }], 120)).toBe("ozet")
  })

  test("hiçbiri geçmediyse görsel olarak ilk bölüm", () => {
    expect(pickActiveSection([{ id: "kanit", top: 900 }, { id: "ozet", top: 400 }], 120)).toBe("ozet")
  })

  test("DOM sırası değil konum belirler (telefonda CSS order)", () => {
    const shuffled = [tops[3], tops[0], tops[2], tops[1]]
    expect(pickActiveSection(shuffled, 120)).toBe("kalemler")
  })

  test("sayfa sonunda kısa son bölüm seçilir", () => {
    expect(pickActiveSection(tops, 120, true)).toBe("odeme")
  })

  test("boş liste ilk bölüme düşer", () => {
    expect(pickActiveSection([], 120)).toBe("ozet")
  })
})
