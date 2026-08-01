import { expect, test } from "bun:test"
import { formatItemAddedMessage, truncateItemName } from "@/lib/orders/item-added-message"

test("parça: ad tırnak içinde, tür ekiyle birlikte", () => {
  expect(formatItemAddedMessage("part", "Ön fren balatası")).toBe("“Ön fren balatası” parçası eklendi")
})

test("işçilik ve dış işçilik kendi etiketini kullanır", () => {
  expect(formatItemAddedMessage("labor", "Yağ değişimi")).toBe("“Yağ değişimi” işçiliği eklendi")
  expect(formatItemAddedMessage("external_labor", "Kaporta")).toBe("“Kaporta” dış işçiliği eklendi")
})

test("ad kırpılmadan önce baştaki/sondaki boşluklar atılır", () => {
  expect(formatItemAddedMessage("part", "  Yağ filtresi  ")).toBe("“Yağ filtresi” parçası eklendi")
})

test("boş ad: tür bazlı genel metne düşer (tırnak basmaz)", () => {
  expect(formatItemAddedMessage("part", "   ")).toBe("Parçası eklendi")
})

test("bilinmeyen tip: türsüz genel metin (sunucu tipi serbest string)", () => {
  expect(formatItemAddedMessage("something_new", "Filtre")).toBe("“Filtre” eklendi")
  expect(formatItemAddedMessage("something_new", "")).toBe("Eklendi")
})

test("uzun katalog adı kırpılır ve … ile biter", () => {
  const long = "Fren Balatası Takımı Ön Aks Havalandırmalı Disk İçin Yüksek Performans Seti"
  const msg = formatItemAddedMessage("part", long)
  expect(msg.endsWith("…” parçası eklendi")).toBe(true)
  expect(msg.length).toBeLessThan(long.length)
})

test("kırpma kelime ortasında bölmez (son boşluğa geri sarar)", () => {
  expect(truncateItemName("Fren balatası takımı ön aks", 20)).toBe("Fren balatası…")
})

test("boşluk çok erkendeyse sert kırpar (tek uzun kelime)", () => {
  expect(truncateItemName("A ABCDEFGHIJKLMNOPQRSTUVWXYZ", 20)).toBe("A ABCDEFGHIJKLMNOPQR…")
})

test("sınırdaki ad kırpılmaz", () => {
  const exact = "12345678901234567890"
  expect(truncateItemName(exact, 20)).toBe(exact)
})
