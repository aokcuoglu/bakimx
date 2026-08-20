import { describe, expect, test } from "bun:test"
import {
  IS_EMRI_REHBER_DESCRIPTION,
  IS_EMRI_REHBER_FAQS,
  IS_EMRI_REHBER_H1,
  IS_EMRI_REHBER_INTRO,
  IS_EMRI_REHBER_PATH,
  IS_EMRI_REHBER_TITLE,
  IS_EMRI_REHBER_UNSURLAR,
} from "./oto-servis-is-emri-nasil-hazirlanir"

describe("iş emri hazırlama rehberi arama niyeti sözleşmesi", () => {
  test("eğitim amacı title, açıklama ve ilk 60 kelimede açıkça tanımlanır", () => {
    const firstSixtyWords = IS_EMRI_REHBER_INTRO.split(/\s+/).slice(0, 60).join(" ")

    expect(IS_EMRI_REHBER_TITLE.toLocaleLowerCase("tr")).toContain("iş emri")
    expect(IS_EMRI_REHBER_H1.toLocaleLowerCase("tr")).toContain("iş emri")
    expect(IS_EMRI_REHBER_DESCRIPTION.toLocaleLowerCase("tr")).toContain("iş emri")
    expect(firstSixtyWords.toLocaleLowerCase("tr")).toContain("iş emri")
    expect(firstSixtyWords).toContain("tek kayıtta")
  })

  test("rehber sayfası kendine özgü canonical kullanır", () => {
    expect(IS_EMRI_REHBER_PATH).toBe("/rehber/oto-servis-is-emri-nasil-hazirlanir")
  })

  test("altı unsurun her biri ne/neden/kanıt üçlüsünü taşır", () => {
    expect(IS_EMRI_REHBER_UNSURLAR).toHaveLength(6)
    for (const unsur of IS_EMRI_REHBER_UNSURLAR) {
      expect(unsur.title.length).toBeGreaterThan(0)
      expect(unsur.what.length).toBeGreaterThan(0)
      expect(unsur.why.length).toBeGreaterThan(0)
      expect(unsur.proof.length).toBeGreaterThan(0)
    }
  })

  test("SSS cevapları 40-80 kelime aralığında kalır", () => {
    for (const faq of IS_EMRI_REHBER_FAQS) {
      const wordCount = faq.answer.split(/\s+/).length
      expect(wordCount).toBeGreaterThanOrEqual(40)
      expect(wordCount).toBeLessThanOrEqual(80)
    }
  })
})
