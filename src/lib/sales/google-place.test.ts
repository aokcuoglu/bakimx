import { describe, expect, it } from "bun:test"
import { parseTurkishSalesAddress } from "./google-place"

describe("Google Place Türkiye adres eşlemesi", () => {
  it("il, ilçe, mahalle, cadde ve numarayı ayrı alanlara taşır", () => {
    expect(parseTurkishSalesAddress([
      { longText: "İstanbul", types: ["administrative_area_level_1"] },
      { longText: "Kadıköy", types: ["administrative_area_level_2"] },
      { longText: "Caferağa Mahallesi", types: ["neighborhood"] },
      { longText: "Moda Caddesi", types: ["route"] },
      { longText: "42", types: ["street_number"] },
      { longText: "34710", types: ["postal_code"] },
    ])).toEqual({
      city: "İstanbul",
      district: "Kadıköy",
      neighborhood: "Caferağa Mahallesi",
      route: "Moda Caddesi",
      streetNumber: "42",
      postalCode: "34710",
      address: "Caferağa Mahallesi, Moda Caddesi No: 42",
    })
  })

  it("ilçe administrative_area_level_2 olarak gelmediğinde sublocality eşlemesini kullanır", () => {
    expect(parseTurkishSalesAddress([
      { longText: "İzmir", types: ["administrative_area_level_1"] },
      { longText: "Bornova", types: ["sublocality_level_1"] },
      { longText: "Kazımdirik", types: ["sublocality_level_2"] },
      { longText: "Ankara Caddesi", types: ["route"] },
    ])).toMatchObject({
      city: "İzmir",
      district: "Bornova",
      neighborhood: "Kazımdirik",
      address: "Kazımdirik, Ankara Caddesi",
    })
  })

  it("Türkiye Places cevabındaki dördüncü seviye mahalleyi ve numara önekini normalize eder", () => {
    expect(parseTurkishSalesAddress([
      { longText: "No:63", shortText: "No:63", types: ["street_number"] },
      { longText: "Bağdat Caddesi", shortText: "Bağdat Cad.", types: ["route"] },
      { longText: "Feneryolu", shortText: "Feneryolu", types: ["administrative_area_level_4", "political"] },
      { longText: "Kadıköy", shortText: "Kadıköy", types: ["administrative_area_level_2", "political"] },
      { longText: "İstanbul", shortText: "İstanbul", types: ["administrative_area_level_1", "political"] },
      { longText: "Türkiye", shortText: "TR", types: ["country", "political"] },
      { longText: "34724", shortText: "34724", types: ["postal_code"] },
    ])).toEqual({
      city: "İstanbul",
      district: "Kadıköy",
      neighborhood: "Feneryolu",
      route: "Bağdat Caddesi",
      streetNumber: "63",
      postalCode: "34724",
      address: "Feneryolu, Bağdat Caddesi No: 63",
    })
  })

  it("eksik Google bileşenleri için alan uydurmaz", () => {
    expect(parseTurkishSalesAddress([
      { longText: "Ankara", types: ["administrative_area_level_1"] },
    ])).toEqual({
      city: "Ankara",
      district: "",
      neighborhood: "",
      route: "",
      streetNumber: "",
      postalCode: "",
      address: "",
    })
  })
})
