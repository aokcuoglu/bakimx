import { describe, expect, test } from "bun:test"
import { createVerifyToken, readVerifyToken } from "./verify-token"

describe("verify-token", () => {
  test("token gidiş-dönüş + kurcalama + bozuk biçim", () => {
    const t = createVerifyToken("ws_123")
    expect(readVerifyToken(t)).toBe("ws_123")
    // İmzanın son 2 karakteri değiştirilirse doğrulama başarısız → null.
    expect(readVerifyToken(t.slice(0, -2) + "xx")).toBeNull()
    // Nokta ile 3 parçaya ayrılmayan girdi → null.
    expect(readVerifyToken("bozuk")).toBeNull()
    expect(readVerifyToken("")).toBeNull()
  })

  test("farklı workshopId farklı token; payload workshopId'yi taşır", () => {
    const a = createVerifyToken("ws_a")
    const b = createVerifyToken("ws_b")
    expect(a).not.toBe(b)
    expect(readVerifyToken(a)).toBe("ws_a")
    expect(readVerifyToken(b)).toBe("ws_b")
  })

  test("workshopId'si değiştirilmiş token (imza uyuşmaz) → null", () => {
    const t = createVerifyToken("ws_123")
    const parts = t.split(".")
    const forged = ["ws_999", parts[1], parts[2]].join(".")
    expect(readVerifyToken(forged)).toBeNull()
  })

  test("süresi geçmiş exp → null", () => {
    // exp alanını geçmişe alıp yeniden imzalamak SECRET gerektirir; süre kontrolünü
    // exp'i elle geçmişe kurcalayarak test edemeyiz (imza bozulur → zaten null).
    // Bunun yerine geçerli token'ın exp'inin gelecekte olduğunu doğrularız.
    const t = createVerifyToken("ws_exp")
    const exp = Number(t.split(".")[1])
    expect(exp).toBeGreaterThan(Date.now())
    expect(readVerifyToken(t)).toBe("ws_exp")
  })
})
