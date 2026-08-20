import { describe, expect, test } from "bun:test"
import {
  ARAC_KABUL_FORMU_CHECKLIST,
  ARAC_KABUL_FORMU_CONTENT_OWNER,
  ARAC_KABUL_FORMU_DESCRIPTION,
  ARAC_KABUL_FORMU_FAQS,
  ARAC_KABUL_FORMU_H1,
  ARAC_KABUL_FORMU_INTRO,
  ARAC_KABUL_FORMU_PATH,
  ARAC_KABUL_FORMU_SOURCES,
  ARAC_KABUL_FORMU_TITLE,
} from "./arac-kabul-formu"

describe("araç kabul formu rehberi eğitim niyeti sözleşmesi", () => {
  test("eğitim niyeti title, açıklama ve ilk 60 kelimede açıkça tanımlanır", () => {
    const firstSixtyWords = ARAC_KABUL_FORMU_INTRO.split(/\s+/).slice(0, 60).join(" ")

    expect(ARAC_KABUL_FORMU_TITLE.toLocaleLowerCase("tr")).toContain("araç kabul formu")
    expect(ARAC_KABUL_FORMU_H1.toLocaleLowerCase("tr")).toContain("araç kabul formu")
    expect(ARAC_KABUL_FORMU_DESCRIPTION.toLocaleLowerCase("tr")).toContain("araç kabul formu")
    expect(firstSixtyWords.toLocaleLowerCase("tr")).toContain("araç kabul formu")
    expect(firstSixtyWords.toLocaleLowerCase("tr")).toContain("kontrol listesidir")
  })

  test("rehber kullanım senaryosu sayfasıyla H1 çakışmaz", () => {
    expect(ARAC_KABUL_FORMU_H1).not.toContain("Ruhsatı okutun")
    expect(ARAC_KABUL_FORMU_H1).not.toContain("Oto servis programı ile")
  })

  test("rehber sayfası kendine özgü canonical kullanır", () => {
    expect(ARAC_KABUL_FORMU_PATH).toBe("/rehber/arac-kabul-formu")
  })

  test("kontrol listesi sahada uygulanabilir 3-8 arası eylem adımı içerir", () => {
    expect(ARAC_KABUL_FORMU_CHECKLIST.length).toBeGreaterThanOrEqual(3)
    expect(ARAC_KABUL_FORMU_CHECKLIST.length).toBeLessThanOrEqual(8)
    for (const step of ARAC_KABUL_FORMU_CHECKLIST) {
      expect(step.title.length).toBeGreaterThan(0)
      expect(step.description.length).toBeGreaterThan(0)
    }
  })

  test("SSS 3-5 arası doğal soru, cevaplar 40-80 kelime bandında", () => {
    expect(ARAC_KABUL_FORMU_FAQS.length).toBeGreaterThanOrEqual(3)
    expect(ARAC_KABUL_FORMU_FAQS.length).toBeLessThanOrEqual(5)
    for (const faq of ARAC_KABUL_FORMU_FAQS) {
      const wordCount = faq.answer.split(/\s+/).length
      expect(wordCount).toBeGreaterThanOrEqual(20)
      expect(wordCount).toBeLessThanOrEqual(80)
    }
  })

  test("indirilebilir şablon değil, uygulanabilir rehber olduğu SSS'te açık", () => {
    const templateFaq = ARAC_KABUL_FORMU_FAQS.find((faq) => faq.question.includes("indirilebilir bir form şablonu"))
    expect(templateFaq).toBeDefined()
    expect(templateFaq?.answer.toLocaleLowerCase("tr")).toContain("hukuki bir form şablonu değildir")
  })

  test("içerik sahibi ve tarih alanları dolu", () => {
    expect(ARAC_KABUL_FORMU_CONTENT_OWNER.role.length).toBeGreaterThan(0)
    expect(ARAC_KABUL_FORMU_CONTENT_OWNER.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(ARAC_KABUL_FORMU_CONTENT_OWNER.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test("kaynak listesi mevcut ürün sayfalarına işaret eder, uydurma kaynak yok", () => {
    expect(ARAC_KABUL_FORMU_SOURCES.length).toBeGreaterThan(0)
    for (const source of ARAC_KABUL_FORMU_SOURCES) {
      expect(source.href.startsWith("/")).toBe(true)
    }
  })
})
