import { describe, expect, test } from "bun:test"
import { PAYMENT_STATUS } from "@/lib/constants"
import { paymentPillTone } from "./payment-pill"

describe("paymentPillTone", () => {
  test("her ödeme durumu için ton", () => {
    expect(paymentPillTone("unpaid")).toBe("destructive")
    expect(paymentPillTone("partial")).toBe("warning")
    expect(paymentPillTone("paid")).toBe("success")
    expect(paymentPillTone("overpaid")).toBe("info")
    expect(paymentPillTone("cancelled")).toBe("neutral")
  })

  test("bilinmeyen durum nötr", () => {
    expect(paymentPillTone("whatever")).toBe("neutral")
  })

  test("PAYMENT_STATUS'taki her anahtar tanımlı bir ton döndürür", () => {
    for (const key of Object.keys(PAYMENT_STATUS)) {
      expect(["info", "warning", "success", "destructive", "neutral"]).toContain(paymentPillTone(key))
    }
  })
})
