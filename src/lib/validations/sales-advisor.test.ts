import { describe, expect, test } from "bun:test"
import {
  salesAdvisorAcceptSchema,
  salesAdvisorInviteSchema,
} from "@/lib/validations/sales-advisor"

describe("sales advisor validations", () => {
  test("davet kimlik bilgilerini normalize eder", () => {
    expect(salesAdvisorInviteSchema.parse({
      email: "  DANISMAN@EXAMPLE.COM ",
      firstName: "  Deniz ",
      lastName: " Kaya  ",
    })).toEqual({ email: "danisman@example.com", firstName: "Deniz", lastName: "Kaya" })
  })

  test("kısa veya eşleşmeyen şifreyi reddeder", () => {
    expect(salesAdvisorAcceptSchema.safeParse({ password: "short", confirmPassword: "short" }).success).toBe(false)
    expect(salesAdvisorAcceptSchema.safeParse({ password: "uzun-sifre", confirmPassword: "baska-sifre" }).success).toBe(false)
    expect(salesAdvisorAcceptSchema.safeParse({ password: "uzun-sifre", confirmPassword: "uzun-sifre" }).success).toBe(true)
  })
})
