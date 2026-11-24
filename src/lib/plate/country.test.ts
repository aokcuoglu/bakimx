import { describe, expect, test } from "bun:test"
import { detectPlate, PLATE_COUNTRY_NAMES, type PlateCountry } from "./country"

/**
 * Plakalar sıkıştırılmış saklanır (`normalizePlate`: boşluk/tire yok), yani ülke
 * yalnız harf/rakam dizilişinden tahmin edilir. Sıra: TR → B → BG → UK → NL → D,
 * tanınmayan her şey TR bandıyla ve olduğu gibi gösterilir (#818).
 */
describe("detectPlate", () => {
  const cases: [input: string, country: PlateCountry, text: string][] = [
    // TR — il kodu (01–81) ile başlayan her harf+rakam dizisi TR'dir
    ["34MHP923", "TR", "34 MHP 923"],
    ["38GZ189", "TR", "38 GZ 189"],
    ["06A12345", "TR", "06 A 12345"],
    ["34 mhp 923", "TR", "34 MHP 923"],
    ["12AB34", "TR", "12 AB 34"], // NL sidecode 3 deseni ama il koduyla başlıyor
    ["34ABC1234", "TR", "34 ABC 1234"], // standart dışı TR yine TR
    // Belçika
    ["1ABC123", "B", "1-ABC-123"],
    ["2XYZ987", "B", "2-XYZ-987"],
    // Bulgaristan
    ["CA1234AB", "BG", "CA 1234 AB"],
    ["K1234AC", "BG", "K 1234 AC"],
    // İngiltere
    ["AB12CDE", "UK", "AB12 CDE"],
    // Hollanda — yalnız Hollanda plakalarında kullanılan ünsüzler
    ["1BDF23", "NL", "1-BDF-23"],
    ["BD123F", "NL", "BD-123-F"],
    ["B123DF", "NL", "B-123-DF"],
    ["BDF12G", "NL", "BDF-12-G"],
    ["B12DFG", "NL", "B-12-DFG"],
    ["1BD234", "NL", "1-BD-234"],
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
    ["6ABC123", "TR", "6ABC123"], // başında sıfır yok — Belçika'ya düşmez
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
