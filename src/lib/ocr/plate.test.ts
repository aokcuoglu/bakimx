import { describe, expect, test } from "bun:test"
import { parsePlateFromText } from "./plate"

describe("parsePlateFromText", () => {
  test("boşluklu plakayı kompakt biçime çevirir", () => {
    expect(parsePlateFromText("34 ABC 123")).toBe("34ABC123")
    expect(parsePlateFromText("06 a 1234")).toBe("06A1234")
  })

  test("sağlayıcının çevre metnini tolere eder", () => {
    expect(parsePlateFromText("TR 35 KL 42")).toBe("35KL42")
  })

  test("geçersiz il kodunu ve boş değeri reddeder", () => {
    expect(parsePlateFromText("99 ABC 123")).toBeNull()
    expect(parsePlateFromText("00 ABC 123")).toBeNull()
    expect(parsePlateFromText("")).toBeNull()
    expect(parsePlateFromText("okunamadı")).toBeNull()
  })
})
