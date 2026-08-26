import { describe, expect, test } from "bun:test"
import { businessProfileFormSchema } from "@/lib/validations/settings"
import { registerSchema } from "@/lib/validations/auth"
import { isValidReferralCode, normalizeReferralCode } from "@/lib/referral-code"

const registerInput = {
  email: "owner@example.com",
  password: "password1",
  firstName: "Ayşe",
  lastName: "Yılmaz",
  workshopName: "Ayşe Oto",
  phone: "05551112233",
  city: "İstanbul",
  address: "Sanayi Mahallesi",
  taxNumber: "1234567890",
  invoiceTitle: "Ayşe Oto",
  kvkkConsent: true,
}

const profileInput = {
  name: "Ayşe Oto",
  phone: "05551112233",
  city: "İstanbul",
  address: "Sanayi Mahallesi",
}

describe("workshop referral code contract", () => {
  test("normalizes casing without turning malformed input into another code", () => {
    expect(normalizeReferralCode("  ornek-42 ")).toBe("ORNEK-42")
    expect(isValidReferralCode("ORNEK-42")).toBe(true)
    expect(isValidReferralCode("ORNEK 42")).toBe(false)
    expect(isValidReferralCode("ABC")).toBe(false)
    expect(isValidReferralCode("A".repeat(25))).toBe(false)
  })

  test("registration keeps the code optional and canonicalizes a supplied code", () => {
    const withoutCode = registerSchema.safeParse(registerInput)
    expect(withoutCode.success).toBe(true)
    if (withoutCode.success) expect(withoutCode.data.referralCode).toBe("")

    const withCode = registerSchema.safeParse({ ...registerInput, referralCode: " ornek-42 " })
    expect(withCode.success).toBe(true)
    if (withCode.success) expect(withCode.data.referralCode).toBe("ORNEK-42")
  })

  test("selecting referral as the source requires a code", () => {
    const result = registerSchema.safeParse({ ...registerInput, acquisitionSource: "referral" })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(["referralCode"])
  })

  test("profile accepts an empty code and canonicalizes a valid code", () => {
    const empty = businessProfileFormSchema.safeParse(profileInput)
    expect(empty.success).toBe(true)
    if (empty.success) expect(empty.data.referralCode).toBe("")

    const saved = businessProfileFormSchema.safeParse({ ...profileInput, referralCode: " servis-2026 " })
    expect(saved.success).toBe(true)
    if (saved.success) expect(saved.data.referralCode).toBe("SERVIS-2026")
  })
})
