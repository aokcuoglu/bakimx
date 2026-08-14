import { test, expect } from "bun:test"
import { buildArticleOemRows } from "./oems"
import { normalizeArticleDetail } from "./normalize"
import { normalizePartSearchTerm } from "@/lib/tr-search"
import detailFixture from "./fixtures/article-detail.json"

test("buildArticleOemRows: numarayı görüntü hâliyle saklar, anahtarı katlar", () => {
  const rows = buildArticleOemRows(7858423, [{ brand: "FORD", number: "KK2Q-6C301-CA" }])
  expect(rows).toEqual([
    { tecdocArticleId: 7858423, brand: "FORD", oemNo: "KK2Q-6C301-CA", searchKey: "kk2q6c301ca" },
  ])
})

test("buildArticleOemRows: anahtar kullanıcının yazdığı ayraçlı/küçük hâlle eşleşir", () => {
  const [row] = buildArticleOemRows(1, [{ brand: "FORD", number: "KK2Q-6C301-CA" }])
  // Arama tarafı sorguyu aynı fonksiyondan geçirir (bkz. searchVehicleArticles).
  for (const typed of ["KK2Q 6C301 CA", "kk2q6c301ca", "KK2Q-6C301-CA", " kk2q 6c301 ca "]) {
    expect(row.searchKey).toContain(normalizePartSearchTerm(typed))
  }
})

test("buildArticleOemRows: aynı numara tekrarında ilk marka temsilci olur", () => {
  const rows = buildArticleOemRows(1, [
    { brand: "FORD", number: "2383422" },
    { brand: "FORD USA", number: "2383422" },
    { brand: "VOLVO", number: "31330017" },
  ])
  expect(rows.map((r) => r.oemNo)).toEqual(["2383422", "31330017"])
  expect(rows[0].brand).toBe("FORD")
})

test("buildArticleOemRows: boş / anahtarsız numaralar elenir", () => {
  const rows = buildArticleOemRows(1, [
    { brand: "FORD", number: "  " },
    { brand: "FORD", number: "---" }, // katlanınca boşa iner → LIKE '%%' her satırla eşleşirdi
    { brand: "", number: " 1234-AB " },
  ])
  expect(rows).toEqual([{ tecdocArticleId: 1, brand: "", oemNo: "1234-AB", searchKey: "1234ab" }])
})

test("buildArticleOemRows: gerçek detay fixture'ı → aranabilir satırlar", () => {
  const detail = normalizeArticleDetail(detailFixture, 0)
  const rows = buildArticleOemRows(detail.tecdocArticleId, detail.oems)
  expect(rows.length).toBe(detail.oems.length)
  expect(rows).toContainEqual({
    tecdocArticleId: 7858423,
    brand: "HONDA",
    oemNo: "15400-679-003",
    searchKey: "15400679003",
  })
})
