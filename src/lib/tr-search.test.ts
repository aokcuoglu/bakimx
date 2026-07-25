import { describe, expect, it } from "bun:test"
import { FOLD_FROM, FOLD_TO, normalizePartSearchTerm, partSearchIncludes, trIncludes } from "./tr-search"

describe("trIncludes", () => {
  it("dotted 'ais' matches 'AISIN' (Turkish dotless-I trap)", () => {
    // "AISIN".toLocaleLowerCase("tr") === "aısın" → tr-lower alone MISSES "ais";
    // the neutral-lowercase OR branch is what saves it.
    expect(trIncludes("AISIN", "ais")).toBe(true)
  })
  it("matches Turkish İ against 'i'", () => {
    expect(trIncludes("İÇTEN", "iç")).toBe(true)
  })
  it("plain case-insensitive contains still works", () => {
    expect(trIncludes("Fren balatası", "balat")).toBe(true)
    expect(trIncludes("7 SEVEN PARTS", "seven")).toBe(true)
  })
  it("non-match returns false", () => {
    expect(trIncludes("BOSCH", "mann")).toBe(false)
  })
  it("empty/whitespace query matches everything", () => {
    expect(trIncludes("BOSCH", "")).toBe(true)
    expect(trIncludes("BOSCH", "   ")).toBe(true)
  })
})

describe("normalizePartSearchTerm", () => {
  it("ayraçları (boşluk/tire/nokta) siler ve küçük harfe indirir", () => {
    expect(normalizePartSearchTerm("C 27 125")).toBe("c27125")
    expect(normalizePartSearchTerm("C-27-125")).toBe("c27125")
    expect(normalizePartSearchTerm("c27125")).toBe("c27125")
    expect(normalizePartSearchTerm("0 986 4B7 035")).toBe("09864b7035")
  })
  it("Türkçe/aksanlı harfleri SİLMEZ, ASCII karşılığına çevirir", () => {
    // Eskiden [^a-z0-9] süzgeci ü/ö/ş'yi silip "süpürge"yi "sprge" yapıyordu:
    // ASCII klavyeyle yazan usta hiçbir Türkçe adlı parçayı bulamıyordu.
    expect(normalizePartSearchTerm("Silecek süpürgesi")).toBe("sileceksupurgesi")
    expect(normalizePartSearchTerm("Yağ filtresi")).toBe("yagfiltresi")
    expect(normalizePartSearchTerm("Debriyaj baskısı")).toBe("debriyajbaskisi")
    expect(normalizePartSearchTerm("ŞANZIMAN")).toBe("sanziman")
  })
  it("Türkçe ve ASCII yazım aynı anahtara iner (İ/I/ı tuzağı dahil)", () => {
    expect(normalizePartSearchTerm("süpürge")).toBe(normalizePartSearchTerm("supurge"))
    expect(normalizePartSearchTerm("İÇTEN")).toBe(normalizePartSearchTerm("icten"))
    expect(normalizePartSearchTerm("ısıtıcı")).toBe(normalizePartSearchTerm("isitici"))
  })
  it("DB tarafı regexp_replace(translate(lower(col),…),'[^a-z0-9]','','g') ile simetriktir", () => {
    // Aynı normalize server'da SQL, client'ta JS olarak koşar; eşleşme için birebir aynı olmalı.
    // Bu ayna, catalog.ts'teki SQL ifadesinin AYNI FOLD_FROM/FOLD_TO tablosunu kullandığını varsayar.
    const sqlNorm = (s: string) => {
      const lowered = s.toLowerCase()
      let translated = ""
      for (const ch of lowered) {
        const i = FOLD_FROM.indexOf(ch)
        translated += i === -1 ? ch : FOLD_TO[i]
      }
      return translated.replace(/[^a-z0-9]/g, "")
    }
    for (const v of ["C 27 125", "AZMT-41-040-1256", "Yağ filtresi", "0 986 4B7 035", "Silecek süpürgesi", "ŞANZIMAN"]) {
      expect(normalizePartSearchTerm(v)).toBe(sqlNorm(v))
    }
  })
  it("FOLD tablosu 1:1 — translate() eşit uzunluk ister", () => {
    expect([...FOLD_FROM].length).toBe([...FOLD_TO].length)
    expect(new Set([...FOLD_FROM]).size).toBe([...FOLD_FROM].length) // tekrar eden kaynak harf yok
  })
})

describe("partSearchIncludes", () => {
  it("boşluksuz yazınca boşluklu/tireli parça no'yu bulur (ekrandaki senaryo)", () => {
    expect(partSearchIncludes("C 27 125", "C27125")).toBe(true)
    expect(partSearchIncludes("C 27 125", "c 27 125")).toBe(true)
    expect(partSearchIncludes("AZMT-41-040-1256", "AZMT410401256")).toBe(true)
  })
  it("parça adı için de ayraç-duyarsız çalışır", () => {
    expect(partSearchIncludes("Hava filtresi", "havafiltresi")).toBe(true)
    expect(partSearchIncludes("Hava filtresi", "hava")).toBe(true)
  })
  it("ASCII klavyeyle yazılan sorgu Türkçe adlı parçayı bulur", () => {
    expect(partSearchIncludes("Silecek süpürgesi", "supurge")).toBe(true)
    expect(partSearchIncludes("Silecek süpürgesi", "süpürge")).toBe(true)
    expect(partSearchIncludes("Yağ filtresi", "yag filtre")).toBe(true)
    expect(partSearchIncludes("Debriyaj baskısı", "baskisi")).toBe(true)
  })
  it("boş needle her şeyle eşleşir, alakasız needle eşleşmez", () => {
    expect(partSearchIncludes("C 27 125", "")).toBe(true)
    expect(partSearchIncludes("C 27 125", "xyz")).toBe(false)
  })
})
