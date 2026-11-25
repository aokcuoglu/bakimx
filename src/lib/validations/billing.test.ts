import { expect, test } from "bun:test"
import { checkoutInAppSchema } from "@/lib/validations/billing"

const validOrder = {
  tier: "pro",
  cycle: "monthly",
  method: "card",
  invoiceTitle: "Örnek Oto Servis",
  taxNumber: "1234567890",
  taxOffice: "Kadıköy",
}

test("ödeme şeması Servis Paketi siparişini kabul eder", () => {
  expect(checkoutInAppSchema.safeParse(validOrder).success).toBe(true)
})

test.each(["lite", "premium"])("ödeme şeması satıştan kalkan %s paketini reddeder (#782)", (tier) => {
  expect(checkoutInAppSchema.safeParse({ ...validOrder, tier }).success).toBe(false)
})

test("ödeme şeması bilinmeyen paketleri reddeder", () => {
  expect(checkoutInAppSchema.safeParse({ ...validOrder, tier: "enterprise" }).success).toBe(false)
})

test("ödeme şeması yeni satışa kapalı Başlangıç paketini reddeder", () => {
  expect(checkoutInAppSchema.safeParse({ ...validOrder, tier: "starter" }).success).toBe(false)
})
