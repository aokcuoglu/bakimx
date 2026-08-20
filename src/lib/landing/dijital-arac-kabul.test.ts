import { describe, expect, test } from "bun:test"
import {
  DIJITAL_ARAC_KABUL_DESCRIPTION,
  DIJITAL_ARAC_KABUL_H1,
  DIJITAL_ARAC_KABUL_INTRO,
  DIJITAL_ARAC_KABUL_PATH,
  DIJITAL_ARAC_KABUL_TITLE,
} from "./dijital-arac-kabul"

describe("dijital araç kabul arama niyeti sözleşmesi", () => {
  test("kullanım senaryosu amacı title, açıklama ve ilk 60 kelimede açıkça tanımlanır", () => {
    const firstSixtyWords = DIJITAL_ARAC_KABUL_INTRO.split(/\s+/).slice(0, 60).join(" ")

    expect(DIJITAL_ARAC_KABUL_TITLE.toLocaleLowerCase("tr")).toContain("dijital araç kabul")
    expect(DIJITAL_ARAC_KABUL_H1.toLocaleLowerCase("tr")).toContain("dijital araç kabul")
    expect(DIJITAL_ARAC_KABUL_DESCRIPTION.toLocaleLowerCase("tr")).toContain("dijital araç kabul")
    expect(firstSixtyWords.toLocaleLowerCase("tr")).toContain("dijital araç kabul")
    expect(firstSixtyWords).toContain("ruhsatı okutarak")
  })

  test("ana sayfa ve kategori sayfasıyla H1 çakışmaz", () => {
    expect(DIJITAL_ARAC_KABUL_H1).not.toContain("Ruhsatı okutun, servis")
    expect(DIJITAL_ARAC_KABUL_H1).not.toContain("Oto servis programı ile")
  })

  test("kullanım senaryosu sayfası kendine özgü canonical kullanır", () => {
    expect(DIJITAL_ARAC_KABUL_PATH).toBe("/dijital-arac-kabul")
  })
})
