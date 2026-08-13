import { expect, test } from "bun:test"
import {
  RESERVED_WORKSHOP_CODES,
  WORKSHOP_CODE_MAX_LENGTH,
  WORKSHOP_CODE_MIN_LENGTH,
  isLoginCodeConflict,
  isReservedWorkshopCode,
  isValidWorkshopCode,
  normalizeWorkshopCode,
  slugifyWorkshopCode,
  workshopCodeCandidate,
} from "./workshop-code"

test("slug Türkçe karakterleri ASCII'ye indirger", () => {
  expect(slugifyWorkshopCode("Şahin Oto Servis")).toBe("sahin-oto-servis")
  expect(slugifyWorkshopCode("ÇİĞDEM Otomotiv")).toBe("cigdem-otomotiv")
  expect(slugifyWorkshopCode("Güngören Işık Oto")).toBe("gungoren-isik-oto")
})

test("slug noktalama ve boşlukları tek tireye çevirir, uçları temizler", () => {
  expect(slugifyWorkshopCode("  Mehmet's  Oto & Servis!  ")).toBe("mehmet-s-oto-servis")
  expect(slugifyWorkshopCode("---Oto---")).toBe("oto")
})

test("slug en fazla 20 karakterdir ve kırpma sonrası tire bırakmaz", () => {
  const slug = slugifyWorkshopCode("Anadolu Yakası Profesyonel Oto Servis Merkezi")
  expect(slug.length).toBeLessThanOrEqual(WORKSHOP_CODE_MAX_LENGTH)
  expect(slug.endsWith("-")).toBe(false)
  // "anadolu-yakasi-profe" → 20. karakterde kesilir
  expect(slug).toBe("anadolu-yakasi-profe")
})

test("slug üretilemeyen isimler boş döner", () => {
  expect(slugifyWorkshopCode("🚗🚙")).toBe("")
  expect(slugifyWorkshopCode("   ")).toBe("")
})

test("geçerli kod: küçük harf, rakam, tek tire; 3–20 karakter", () => {
  expect(isValidWorkshopCode("mehmet-oto")).toBe(true)
  expect(isValidWorkshopCode("oto2")).toBe(true)
  expect(isValidWorkshopCode("abc")).toBe(true)
})

test("geçersiz kod: kısa, uzun, uçta/ardışık tire, boşluk, alt tire", () => {
  expect(isValidWorkshopCode("ab")).toBe(false)
  expect(isValidWorkshopCode("a".repeat(WORKSHOP_CODE_MAX_LENGTH + 1))).toBe(false)
  expect(isValidWorkshopCode("-oto")).toBe(false)
  expect(isValidWorkshopCode("oto-")).toBe(false)
  expect(isValidWorkshopCode("oto--servis")).toBe(false)
  expect(isValidWorkshopCode("oto servis")).toBe(false)
  expect(isValidWorkshopCode("oto_servis")).toBe(false)
})

test("rezerve kelimeler kod olarak kabul edilmez", () => {
  for (const reserved of RESERVED_WORKSHOP_CODES) {
    expect(isReservedWorkshopCode(reserved)).toBe(true)
    expect(isValidWorkshopCode(reserved)).toBe(false)
  }
  // Rezerve kelimeyi İÇEREN kod yasak değil — yalnız birebir eşleşme.
  expect(isValidWorkshopCode("admin-oto")).toBe(true)
})

test("normalize: kırpar ve küçük harfe indirir", () => {
  expect(normalizeWorkshopCode("  MEHMET-Oto ")).toBe("mehmet-oto")
  expect(isValidWorkshopCode("  MEHMET-Oto ")).toBe(true)
})

test("ilk aday sade slug'dır", () => {
  expect(workshopCodeCandidate("Mehmet Oto", 0)).toBe("mehmet-oto")
  expect(workshopCodeCandidate("Mehmet Oto")).toBe("mehmet-oto")
})

test("slug kullanılamıyorsa taban adaya düşer", () => {
  expect(workshopCodeCandidate("🚗", 0)).toBe("atolye")
  expect(workshopCodeCandidate("AB", 0)).toBe("atolye")
  // Rezerve kelimeye eşit slug da tabana düşer ("Demo" → "demo").
  expect(workshopCodeCandidate("Demo", 0)).toBe("atolye")
})

test("çakışma turlarında aday değişir ve geçerli kalır", () => {
  const first = workshopCodeCandidate("Mehmet Oto", 0)
  const retries = Array.from({ length: 25 }, (_, i) => workshopCodeCandidate("Mehmet Oto", i + 1))

  for (const code of retries) {
    expect(isValidWorkshopCode(code)).toBe(true)
    expect(code).not.toBe(first)
    expect(code.startsWith("mehmet-oto-")).toBe(true)
  }
  // Rastgele sonek gerçekten çeşitleniyor (aynı adayı sonsuz denemeyelim).
  expect(new Set(retries).size).toBeGreaterThan(1)
})

test("uzun isimde sonekli aday da 20 karakteri aşmaz", () => {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const code = workshopCodeCandidate("Anadolu Yakası Profesyonel Oto Servis Merkezi", attempt)
    expect(code.length).toBeLessThanOrEqual(WORKSHOP_CODE_MAX_LENGTH)
    expect(code.length).toBeGreaterThanOrEqual(WORKSHOP_CODE_MIN_LENGTH)
    expect(isValidWorkshopCode(code)).toBe(true)
  }
})

test("P2002 yalnız loginCode hedefliyorsa çakışma sayılır", () => {
  expect(isLoginCodeConflict({ code: "P2002", meta: { target: ["loginCode"] } })).toBe(true)
  expect(isLoginCodeConflict({ code: "P2002", meta: { target: "Workshop_loginCode_key" } })).toBe(true)
  expect(isLoginCodeConflict({ code: "P2002", meta: { target: ["email"] } })).toBe(false)
  expect(isLoginCodeConflict({ code: "P2025" })).toBe(false)
  expect(isLoginCodeConflict(new Error("boom"))).toBe(false)
})
