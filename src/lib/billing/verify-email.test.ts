import { describe, expect, test } from "bun:test"
import { buildVerifyUrl } from "./verify-email"

describe("buildVerifyUrl", () => {
  test("sondaki slash'i temizler ve token'ı encode eder", () => {
    expect(buildVerifyUrl("https://app.bakimx.com/", "a.b.c")).toBe(
      "https://app.bakimx.com/api/auth/verify-email?token=a.b.c"
    )
  })
  test("slash olmadan da doğru birleştirir; özel karakterleri encode eder", () => {
    expect(buildVerifyUrl("http://localhost:3000", "a b+c")).toBe(
      "http://localhost:3000/api/auth/verify-email?token=a%20b%2Bc"
    )
  })
})
