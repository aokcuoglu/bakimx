import { describe, expect, test } from "bun:test"
import {
  ORDER_SECTIONS,
  isOrderSectionId,
  pickActiveSection,
  sectionForLegacyTab,
  sectionUrl,
  urlWithout,
} from "@/lib/orders/detail-sections"

describe("ORDER_SECTIONS (#911)", () => {
  test("altı bölüm, iş akışı sırasıyla", () => {
    expect(ORDER_SECTIONS.map((s) => s.id)).toEqual(["ozet", "kalemler", "kanit", "odeme", "teknisyen", "gecmis"])
    expect(ORDER_SECTIONS.map((s) => s.label)).toEqual(["Özet", "Kalemler", "Kanıt", "Ödeme", "Teknisyen", "Geçmiş"])
  })
})

test("isOrderSectionId yalnız bölüm kimliklerini kabul eder", () => {
  expect(isOrderSectionId("kalemler")).toBe(true)
  expect(isOrderSectionId("parca")).toBe(false)
  expect(isOrderSectionId("")).toBe(false)
  expect(isOrderSectionId(undefined)).toBe(false)
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
  test("yalnız hash değişir; sorgu aynen kalır (replaceState için)", () => {
    expect(sectionUrl("https://app.test/orders/abc?returnTo=%2Forders", "kanit")).toBe("/orders/abc?returnTo=%2Forders#kanit")
    expect(sectionUrl("https://app.test/orders/abc#ozet", "gecmis")).toBe("/orders/abc#gecmis")
  })

  test("drop verilen parametreler düşer, returnTo korunur", () => {
    const href = "https://app.test/orders/abc?tab=parca&edit=1&returnTo=%2Forders%3Fstatus%3Dopen"
    expect(sectionUrl(href, "kalemler", ["tab"])).toBe("/orders/abc?edit=1&returnTo=%2Forders%3Fstatus%3Dopen#kalemler")
    expect(sectionUrl(href, "kalemler", ["tab", "edit"])).toBe("/orders/abc?returnTo=%2Forders%3Fstatus%3Dopen#kalemler")
  })
})

describe("urlWithout", () => {
  test("parametre düşer, returnTo ve hash korunur", () => {
    expect(urlWithout("https://app.test/orders/abc?returnTo=%2Forders&edit=1#kanit", ["edit"])).toBe("/orders/abc?returnTo=%2Forders#kanit")
    expect(urlWithout("https://app.test/orders/abc?edit=1", ["edit"])).toBe("/orders/abc")
    expect(urlWithout("https://app.test/orders/abc?tab=ozet&returnTo=%2Forders", ["tab"])).toBe("/orders/abc?returnTo=%2Forders")
  })

  test("parametre yoksa adres değişmez (null)", () => {
    expect(urlWithout("https://app.test/orders/abc?returnTo=%2Forders", ["edit"])).toBeNull()
    expect(urlWithout("https://app.test/orders/abc", ["tab", "edit"])).toBeNull()
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
