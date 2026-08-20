import { describe, expect, test } from "bun:test"
import {
  OTO_SERVIS_PROGRAMI_DESCRIPTION,
  OTO_SERVIS_PROGRAMI_H1,
  OTO_SERVIS_PROGRAMI_INTRO,
  OTO_SERVIS_PROGRAMI_PATH,
  OTO_SERVIS_PROGRAMI_TITLE,
} from "./oto-servis-programi"

describe("oto servis programı arama niyeti sözleşmesi", () => {
  test("kategori amacı title, açıklama ve ilk 60 kelimede açıkça tanımlanır", () => {
    const firstSixtyWords = OTO_SERVIS_PROGRAMI_INTRO.split(/\s+/).slice(0, 60).join(" ")

    expect(OTO_SERVIS_PROGRAMI_TITLE.toLocaleLowerCase("tr")).toContain("oto servis programı")
    expect(OTO_SERVIS_PROGRAMI_H1.toLocaleLowerCase("tr")).toContain("oto servis programı")
    expect(OTO_SERVIS_PROGRAMI_DESCRIPTION.toLocaleLowerCase("tr")).toContain("oto servis programı")
    expect(firstSixtyWords.toLocaleLowerCase("tr")).toContain("oto servis programı")
    expect(firstSixtyWords).toContain("araç kabulden")
    expect(OTO_SERVIS_PROGRAMI_H1).not.toContain("Ruhsatı okutun")
  })

  test("kategori sayfası kendine özgü canonical kullanır", () => {
    expect(OTO_SERVIS_PROGRAMI_PATH).toBe("/oto-servis-programi")
  })
})
