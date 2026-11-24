import { describe, expect, test } from "bun:test"
import { detectPlate, PLATE_COUNTRY_NAMES, type PlateCountry } from "./country"

/**
 * Plakalar sıkıştırılmış saklanır (`normalizePlate`: boşluk/tire yok), yani ülke
 * yalnız harf/rakam dizilişinden tahmin edilir. Sıra: TR → B → BG → UK → NL → D,
 * tanınmayan her şey TR bandıyla ve olduğu gibi gösterilir (#818).
 */
describe("detectPlate", () => {
  const cases: [input: string, country: PlateCountry, text: string][] = [
    // TR — 1–2 rakamla başlayan her harf+rakam dizisi TR'dir (yanlış yazılmış TR yabancı görünmez)
    ["34MHP923", "TR", "34 MHP 923"],
    ["38GZ189", "TR", "38 GZ 189"],
    ["06A12345", "TR", "06 A 12345"],
    ["34 mhp 923", "TR", "34 MHP 923"],
    ["12BD34", "TR", "12 BD 34"], // NL sidecode 3 deseni (ünsüzler) ama il koduyla başlıyor — TR önce
    ["34ABC1234", "TR", "34 ABC 1234"], // standart dışı TR yine TR
    // Başındaki sıfırı düşmüş / aralık dışı il kodu — yine TR, Hollanda'ya düşmez
    ["6BD123", "TR", "6 BD 123"], // Ankara 06 BD 123
    ["6BDF12", "TR", "6 BDF 12"],
    ["7KL345", "TR", "7 KL 345"],
    ["1BDF23", "TR", "1 BDF 23"], // NL sidecode 8 deseni
    ["91BD12", "TR", "91 BD 12"],
    ["00BD12", "TR", "00 BD 12"],
    ["6ABC123", "TR", "6 ABC 123"], // başında sıfır yok — Belçika'ya düşmez
    ["34ÖAB12", "TR", "34 ÖAB 12"], // OCR Türkçe harfi saklayabiliyor (lib/ocr/plate.ts)
    // Belçika
    ["1ABC123", "B", "1-ABC-123"],
    ["2XYZ987", "B", "2-XYZ-987"],
    // Bulgaristan
    ["CA1234AB", "BG", "CA 1234 AB"],
    ["K1234AC", "BG", "K 1234 AC"],
    // İngiltere
    ["AB12CDE", "UK", "AB12 CDE"],
    // Hollanda — yalnız Hollanda plakalarında kullanılan ünsüzler
    ["1234BD", "NL", "12-34-BD"],
    ["BD123F", "NL", "BD-123-F"],
    ["B123DF", "NL", "B-123-DF"],
    ["BDF12G", "NL", "BDF-12-G"],
    ["B12DFG", "NL", "B-12-DFG"],
    ["123BD4", "NL", "123-BD-4"],
    ["BD12FG", "NL", "BD-12-FG"],
    ["12BDFG", "NL", "12-BD-FG"],
    // Almanya
    ["MAB1234", "D", "MAB 1234"],
    ["BAB123E", "D", "BAB 123E"],
    ["ABC123", "D", "ABC 123"],
    // Yedek: TR bandı, metin trim + büyük harf, olduğu gibi
    ["GU1234AB", "TR", "GU1234AB"], // Avusturya — BG il kodu değil
    ["W12345A", "TR", "W12345A"], // Avusturya
    ["AB123CD", "TR", "AB123CD"], // Fransa/İtalya çakışması
    ["  xyz  ", "TR", "XYZ"],
    ["", "TR", ""],
  ]

  test.each(cases)("%p → %p %p", (input, country, text) => {
    expect(detectPlate(input)).toEqual({ country, text })
  })
})

test("PLATE_COUNTRY_NAMES her ülke kodunun Türkçe adını taşır", () => {
  expect(PLATE_COUNTRY_NAMES).toEqual({
    TR: "Türkiye",
    D: "Almanya",
    NL: "Hollanda",
    B: "Belçika",
    BG: "Bulgaristan",
    UK: "İngiltere",
  })
})
