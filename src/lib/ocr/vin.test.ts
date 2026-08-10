import { test, expect, describe } from "bun:test"
import { parseVinFromText } from "./vin"

describe("parseVinFromText", () => {
  test("temiz VIN'i olduğu gibi döndürür", () => {
    expect(parseVinFromText("WF0AXXGCHAK12345Y")).toBe("WF0AXXGCHAK12345Y")
  })

  test("küçük harfi ve baş/son boşluğu normalleştirir", () => {
    expect(parseVinFromText("  wf0axxgchak12345y \n")).toBe("WF0AXXGCHAK12345Y")
  })

  test("OCR'ın boşlukla böldüğü VIN'i birleştirir", () => {
    expect(parseVinFromText("WF0AXX GCHAK 12345Y")).toBe("WF0AXXGCHAK12345Y")
  })

  test("tire/nokta gibi ayraçları atar", () => {
    expect(parseVinFromText("WF0AXX-GCHAK.12345Y")).toBe("WF0AXXGCHAK12345Y")
  })

  test("etiketli satırdan 17 haneli jetonu seçer", () => {
    expect(parseVinFromText("VIN: WF0AXXGCHAK12345Y")).toBe("WF0AXXGCHAK12345Y")
    expect(parseVinFromText("ŞASE NO\nWF0AXXGCHAK12345Y\nMOTOR NO 2ZR")).toBe("WF0AXXGCHAK12345Y")
  })

  test("VIN alfabesinde olmayan I/O/Q harflerini 1/0/0 olarak düzeltir", () => {
    expect(parseVinFromText("WFOAXXGCHAKI2345Y")).toBe("WF0AXXGCHAK12345Y")
    expect(parseVinFromText("QF0AXXGCHAK12345Y")).toBe("0F0AXXGCHAK12345Y")
  })

  test("17 haneden kısa okumayı reddeder", () => {
    expect(parseVinFromText("WF0AXXGCHAK1234")).toBeNull()
  })

  test("17 haneden uzun bitişik diziyi reddeder (belirsiz pencere)", () => {
    expect(parseVinFromText("XWF0AXXGCHAK12345Y")).toBeNull()
    expect(parseVinFromText("VIN1HGBH41JXMN109186")).toBeNull()
  })

  test("boş / anlamsız metinde null döner", () => {
    expect(parseVinFromText("")).toBeNull()
    expect(parseVinFromText(null)).toBeNull()
    expect(parseVinFromText(undefined)).toBeNull()
    expect(parseVinFromText("---")).toBeNull()
    expect(parseVinFromText("okunamadi")).toBeNull()
  })

  test("iki ayrı 17 haneli jetondan ilkini seçer", () => {
    expect(parseVinFromText("WF0AXXGCHAK12345Y ZFA31200003456789")).toBe("WF0AXXGCHAK12345Y")
  })
})
