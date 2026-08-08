import { expect, test, describe } from "bun:test"
import { BRAND_ICON_PATHS, BRAND_ICON_TITLES, BRAND_ICON_VIEWBOX, type BrandIconKey } from "./brand-icons"

/**
 * #279 — vendor'lanmış marka ikonlarının bütünlük kontrolü.
 *
 * Yol verisi elle güncellendiğinde (yeni platform, Simple Icons sürüm yükseltmesi)
 * sessizce bozulabilir: eksik anahtar, kırpılmış yol, ya da ham HTML'e basıldığı
 * için tırnak/etiket kaçışı. Bu testler onu yakalar.
 */

const KEYS: BrandIconKey[] = ["instagram", "facebook", "x", "tiktok", "youtube", "linkedin"]

describe("BRAND_ICON_PATHS", () => {
  test("altı platformun tamamı tanımlı", () => {
    expect(Object.keys(BRAND_ICON_PATHS).sort()).toEqual([...KEYS].sort())
    expect(Object.keys(BRAND_ICON_TITLES).sort()).toEqual([...KEYS].sort())
  })

  test("her yol geçerli bir SVG path verisi gibi görünüyor", () => {
    for (const key of KEYS) {
      const path = BRAND_ICON_PATHS[key]
      // Anlamlı uzunluk: kırpılmış/boş bir yol sessizce boş ikon basar.
      expect(path.length).toBeGreaterThan(100)
      // SVG path komutu ile başlar (M/m = moveto).
      expect(path.startsWith("M") || path.startsWith("m")).toBe(true)
      // Yalnızca path dilbilgisine ait karakterler.
      expect(path).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9\s.,+-]+$/)
    }
  })

  test("yol verisi ham HTML'e basıldığı için attribute'tan kaçamıyor", () => {
    for (const key of KEYS) {
      const path = BRAND_ICON_PATHS[key]
      expect(path).not.toContain('"')
      expect(path).not.toContain("'")
      expect(path).not.toContain("<")
      expect(path).not.toContain(">")
    }
  })

  test("viewBox tek ve sabit — ikonlar aynı ızgarada", () => {
    expect(BRAND_ICON_VIEWBOX).toBe("0 0 24 24")
  })
})
