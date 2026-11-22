import { expect, test } from "bun:test"
import { callbackRequestSchema } from "./callback-request"

const valid = { name: "Ali Veli", phone: "0532 123 45 67", consent: true }

test.each(["+90 532 123 45 67", "905321234567", "5321234567", "0532 123 45 67"])("cep telefonu %s kabul edilir", (phone) => {
  expect(callbackRequestSchema.safeParse({ ...valid, phone }).success).toBe(true)
})

test.each(["0212 123 45 67", "532123456", ""])("geçersiz telefon %p reddedilir", (phone) => {
  const result = callbackRequestSchema.safeParse({ ...valid, phone })
  expect(result.success).toBe(false)
  expect(result.error?.issues[0]?.message).toBe("Cep telefonu numaranızı 05xx xxx xx xx biçiminde yazın.")
})

test("tek kelimelik ad reddedilir", () => {
  const result = callbackRequestSchema.safeParse({ ...valid, name: "  Ali  " })
  expect(result.success).toBe(false)
  expect(result.error?.issues[0]?.message).toBe("Adınızı ve soyadınızı yazın.")
})

test("onaysız gönderim reddedilir", () => {
  const result = callbackRequestSchema.safeParse({ ...valid, consent: false })
  expect(result.success).toBe(false)
  expect(result.error?.issues[0]?.message).toBe("Devam etmek için onay kutusunu işaretleyin.")
})
