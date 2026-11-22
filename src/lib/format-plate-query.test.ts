import { describe, expect, test } from "bun:test"
import { uppercaseIfPlateLike } from "@/lib/format"

describe("uppercaseIfPlateLike", () => {
  test("plaka biçimindeki girişi büyük harfe çevirir", () => {
    expect(uppercaseIfPlateLike("34abc123")).toBe("34ABC123")
    expect(uppercaseIfPlateLike("06 xy 45")).toBe("06 XY 45")
    expect(uppercaseIfPlateLike(" 35a")).toBe(" 35A")
  })

  test("müşteri adını olduğu gibi bırakır", () => {
    expect(uppercaseIfPlateLike("ali")).toBe("ali")
    expect(uppercaseIfPlateLike("Şükrü Yılmaz")).toBe("Şükrü Yılmaz")
    expect(uppercaseIfPlateLike("")).toBe("")
  })
})
