import { describe, expect, test } from "bun:test"
import { checkoutPublicSchema } from "@/lib/validations/billing"
import { registerSchema } from "@/lib/validations/auth"
import { normalizeAcquisitionAdvisorId } from "@/lib/acquisition-sources"

describe("workshop acquisition source contract", () => {
  test("valid source values are accepted and omitted source defaults to unknown", () => {
    const result = registerSchema.safeParse({ email: "a@b.com", password: "password1", firstName: "A", lastName: "B", workshopName: "AB", phone: "1234567890", city: "İstanbul", address: "Adres", taxNumber: "1234567890", invoiceTitle: "AB", kvkkConsent: true })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.acquisitionSource).toBe("unknown")
  })

  test("invalid source is rejected", () => {
    expect(checkoutPublicSchema.safeParse({ acquisitionSource: "not-a-source" }).success).toBe(false)
  })

  test("representative assignment is normalized independently from acquisition source", () => {
    expect(normalizeAcquisitionAdvisorId(" advisor-1 ")).toBe("advisor-1")
    expect(normalizeAcquisitionAdvisorId("")).toBeNull()
    expect(normalizeAcquisitionAdvisorId(undefined)).toBeNull()
  })
})
