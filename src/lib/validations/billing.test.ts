import { expect, test } from "bun:test"
import { checkoutInAppSchema } from "@/lib/validations/billing"

const validOrder = {
  tier: "lite",
  cycle: "monthly",
  method: "card",
  invoiceTitle: "Örnek Oto Servis",
  taxNumber: "1234567890",
  taxOffice: "Kadıköy",
}

test("ödeme şeması Lite paket siparişini kabul eder", () => {
  expect(checkoutInAppSchema.safeParse(validOrder).success).toBe(true)
})

test("ödeme şeması bilinmeyen paketleri reddeder", () => {
  expect(checkoutInAppSchema.safeParse({ ...validOrder, tier: "enterprise" }).success).toBe(false)
})
