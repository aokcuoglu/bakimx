import { describe, expect, test } from "bun:test"
import { canResumeVerification } from "./verify-resume"

describe("canResumeVerification", () => {
  const ok = { passwordValid: true, approvalStatus: "pending", trialStartedAt: null as Date | null }

  test("üç koşul birden → resume", () => {
    expect(canResumeVerification(ok)).toBe(true)
  })

  test("yanlış şifre → resume YOK", () => {
    expect(canResumeVerification({ ...ok, passwordValid: false })).toBe(false)
  })

  test("workshop pending değil (approved) → resume YOK", () => {
    expect(canResumeVerification({ ...ok, approvalStatus: "approved" })).toBe(false)
    expect(canResumeVerification({ ...ok, approvalStatus: "rejected" })).toBe(false)
  })

  test("trial zaten başlamış → resume YOK (doğrulanmış hesap)", () => {
    expect(canResumeVerification({ ...ok, trialStartedAt: new Date() })).toBe(false)
  })

  test("hepsi ters → resume YOK", () => {
    expect(
      canResumeVerification({ passwordValid: false, approvalStatus: "approved", trialStartedAt: new Date() })
    ).toBe(false)
  })
})
