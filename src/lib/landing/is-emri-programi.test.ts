import { describe, expect, test } from "bun:test"
import {
  IS_EMRI_PROGRAMI_DESCRIPTION,
  IS_EMRI_PROGRAMI_H1,
  IS_EMRI_PROGRAMI_INTRO,
  IS_EMRI_PROGRAMI_PATH,
  IS_EMRI_PROGRAMI_TITLE,
} from "./is-emri-programi"

describe("iş emri programı arama niyeti sözleşmesi", () => {
  test("kullanım senaryosu amacı title, açıklama ve ilk 60 kelimede açıkça tanımlanır", () => {
    const firstSixtyWords = IS_EMRI_PROGRAMI_INTRO.split(/\s+/).slice(0, 60).join(" ")

    expect(IS_EMRI_PROGRAMI_TITLE.toLocaleLowerCase("tr")).toContain("iş emri programı")
    expect(IS_EMRI_PROGRAMI_H1.toLocaleLowerCase("tr")).toContain("iş emri programı")
    expect(IS_EMRI_PROGRAMI_DESCRIPTION.toLocaleLowerCase("tr")).toContain("iş emri programı")
    expect(firstSixtyWords.toLocaleLowerCase("tr")).toContain("iş emri programı")
    expect(firstSixtyWords).toContain("parça ve işçilik")
    expect(IS_EMRI_PROGRAMI_H1).not.toContain("Ruhsatı okutun")
  })

  test("kullanım senaryosu sayfası kendine özgü canonical kullanır", () => {
    expect(IS_EMRI_PROGRAMI_PATH).toBe("/is-emri-programi")
  })
})
