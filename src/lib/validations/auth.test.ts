import { expect, test } from "bun:test"
import { forgotPasswordSchema, resetPasswordSchema } from "./auth"

test("forgotPasswordSchema rejects invalid email, accepts valid", () => {
  expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false)
  expect(forgotPasswordSchema.safeParse({ email: "a@b.com" }).success).toBe(true)
})

test("resetPasswordSchema needs password >= 8 chars", () => {
  const r = resetPasswordSchema.safeParse({ token: "t", password: "short", confirmPassword: "short" })
  expect(r.success).toBe(false)
})

test("resetPasswordSchema needs matching passwords", () => {
  const r = resetPasswordSchema.safeParse({ token: "t", password: "longenough", confirmPassword: "different1" })
  expect(r.success).toBe(false)
})

test("resetPasswordSchema accepts valid matching passwords", () => {
  const r = resetPasswordSchema.safeParse({ token: "t", password: "longenough", confirmPassword: "longenough" })
  expect(r.success).toBe(true)
})
