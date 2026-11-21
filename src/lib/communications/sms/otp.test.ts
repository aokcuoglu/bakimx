import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import type { SMSProvider } from "../types"
import { deliveryOtpMessage, isMockSmsOtp, sendSmsOtp } from "./otp"

function fakeProvider(impl: SMSProvider["sendSMS"]) {
  const calls: [string, string][] = []
  const provider: SMSProvider = {
    async sendSMS(to, message) {
      calls.push([to, message])
      return impl(to, message)
    },
  }
  return { provider, calls }
}

let savedProvider: string | undefined
beforeEach(() => {
  savedProvider = process.env.SMS_PROVIDER
})
afterEach(() => {
  if (savedProvider === undefined) delete process.env.SMS_PROVIDER
  else process.env.SMS_PROVIDER = savedProvider
})

describe("SMS teslim OTP", () => {
  for (const phone of ["0542 368 14 38", "+905423681438", "5423681438"]) {
    test(`normalizes recipient ${phone} and sends the code`, async () => {
      const { provider, calls } = fakeProvider(async () => ({ success: true, providerId: "sms-1" }))
      expect(await sendSmsOtp(phone, "123456", provider)).toEqual({ success: true, providerId: "sms-1" })
      expect(calls).toEqual([["5423681438", deliveryOtpMessage("123456")]])
      expect(calls[0][1]).toContain("123456")
    })
  }

  test("rejects malformed numbers and codes without calling the provider", async () => {
    const { provider, calls } = fakeProvider(async () => ({ success: true }))
    expect((await sendSmsOtp("12345", "123456", provider)).success).toBe(false)
    expect((await sendSmsOtp("5423681438", "12ab56", provider)).success).toBe(false)
    expect(calls).toHaveLength(0)
  })

  test("does not leak provider error bodies", async () => {
    const { provider } = fakeProvider(async () => ({ success: false, error: "token=secret to=5423681438 code=123456" }))
    const result = await sendSmsOtp("5423681438", "123456", provider)
    expect(result.success).toBe(false)
    expect(result.error).not.toContain("secret")
    expect(result.error).not.toContain("123456")
  })

  test("turns a thrown provider error into a failure", async () => {
    const { provider } = fakeProvider(async () => {
      throw new Error("network down: token=secret")
    })
    const result = await sendSmsOtp("5423681438", "123456", provider)
    expect(result).toEqual({ success: false, error: "SMS onay kodu gönderilemedi" })
  })

  test("mock mode follows SMS_PROVIDER", () => {
    delete process.env.SMS_PROVIDER
    expect(isMockSmsOtp()).toBe(true)
    process.env.SMS_PROVIDER = "netgsm"
    expect(isMockSmsOtp()).toBe(false)
  })
})
