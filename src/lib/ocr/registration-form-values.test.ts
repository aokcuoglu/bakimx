import { describe, expect, test } from "bun:test"
import { hasRegistrationData, parseRegistrationOcr } from "./registration-form-values"

describe("parseRegistrationOcr", () => {
  test("alanları kırpar, plaka/şase/motor no'yu büyük harfe çevirir, güveni taşır", () => {
    const r = parseRegistrationOcr({
      plate: { value: " 34abc123 ", confidence: 0.9 },
      vin: { value: "wvwzzz1kz8w000001", confidence: 0.5 },
      engineNo: { value: "cax123" },
      brand: { value: "Volkswagen" },
      ownerName: { value: "Ali" },
      ownerSurname: { value: "Yılmaz" },
    })
    expect(r.values.plate).toBe("34ABC123")
    expect(r.values.vin).toBe("WVWZZZ1KZ8W000001")
    expect(r.values.engineNo).toBe("CAX123")
    expect(r.values.model).toBe("")
    expect(r.confidence.plate).toBe(0.9)
    expect(r.confidence.vin).toBe(0.5)
    expect(r.confidence.model).toBeUndefined()
    expect(r.owner).toEqual({ isCorporate: false, firstName: "Ali", lastName: "Yılmaz", companyName: "", label: "Ali Yılmaz" })
  })

  test("ADI boş, SOYADI/ÜNVAN dolu ise sahip kurumsaldır", () => {
    const r = parseRegistrationOcr({ ownerName: { value: "" }, ownerSurname: { value: "ACME OTO A.Ş." } })
    expect(r.owner).toEqual({ isCorporate: true, firstName: "", lastName: "", companyName: "ACME OTO A.Ş.", label: "ACME OTO A.Ş." })
  })
})

describe("hasRegistrationData", () => {
  test("hiçbir alan okunmadıysa false — ruhsat değil ya da bulanık kare", () => {
    expect(hasRegistrationData(parseRegistrationOcr({}))).toBe(false)
    expect(hasRegistrationData(parseRegistrationOcr({ plate: { value: "  " } }))).toBe(false)
  })

  test("tek bir araç alanı ya da yalnız sahip adı yeterli", () => {
    expect(hasRegistrationData(parseRegistrationOcr({ brand: { value: "Fiat" } }))).toBe(true)
    expect(hasRegistrationData(parseRegistrationOcr({ ownerSurname: { value: "ACME" } }))).toBe(true)
  })
})
