import { expect, test } from "bun:test"
import {
  minorToTamiAmount,
  tamiAmountEqualsMinor,
  generateProviderOrderId,
  resolveClientIp,
  splitName,
  luhnCheck,
} from "./payment-helpers"

test("minorToTamiAmount: kuruş → 2 ondalık lira", () => {
  expect(minorToTamiAmount(749900)).toBe(7499)
  expect(minorToTamiAmount(749900).toFixed(2)).toBe("7499.00")
  expect(minorToTamiAmount(749950).toFixed(2)).toBe("7499.50")
  expect(minorToTamiAmount(1999).toFixed(2)).toBe("19.99")
  expect(minorToTamiAmount(0).toFixed(2)).toBe("0.00")
})

test("generateProviderOrderId: 2-36 kar., reference prefix'li, benzersiz", () => {
  const ref = "BX-ACDEFG"
  const a = generateProviderOrderId(ref)
  const b = generateProviderOrderId(ref)
  expect(a.startsWith(`${ref}-`)).toBe(true)
  expect(a.length).toBeGreaterThanOrEqual(2)
  expect(a.length).toBeLessThanOrEqual(36)
  expect(a).not.toBe(b) // iki çağrı farklı
})

test("resolveClientIp: x-forwarded-for ilk IP, sonra x-real-ip, sonra 0.0.0.0", () => {
  expect(resolveClientIp("1.2.3.4, 5.6.7.8", null)).toBe("1.2.3.4")
  expect(resolveClientIp("  9.9.9.9 , 5.6.7.8", null)).toBe("9.9.9.9")
  expect(resolveClientIp(null, "8.8.8.8")).toBe("8.8.8.8")
  expect(resolveClientIp(null, null)).toBe("0.0.0.0")
  expect(resolveClientIp("", "")).toBe("0.0.0.0")
})

test("splitName: ad/soyad ayrımı", () => {
  expect(splitName("Ali Veli")).toEqual({ name: "Ali", surName: "Veli" })
  expect(splitName("Ali Can Veli")).toEqual({ name: "Ali", surName: "Can Veli" })
  expect(splitName("Ali")).toEqual({ name: "Ali", surName: "Ali" })
  expect(splitName("  ")).toEqual({ name: "-", surName: "-" })
})

test("tamiAmountEqualsMinor: wire formatlarından bağımsız", () => {
  expect(tamiAmountEqualsMinor("1", 100)).toBe(true)      // canlı yakalanan format
  expect(tamiAmountEqualsMinor("1.00", 100)).toBe(true)
  expect(tamiAmountEqualsMinor("1299.5", 129950)).toBe(true)
  expect(tamiAmountEqualsMinor("2", 100)).toBe(false)
  expect(tamiAmountEqualsMinor("abc", 100)).toBe(false)
  expect(tamiAmountEqualsMinor("", 100)).toBe(false)
})

test("luhnCheck: geçerli/geçersiz kart numaraları", () => {
  expect(luhnCheck("4242 4242 4242 4242")).toBe(true)
  expect(luhnCheck("4242424242424242")).toBe(true)
  expect(luhnCheck("4242424242424241")).toBe(false)
  expect(luhnCheck("1234")).toBe(false) // çok kısa
  expect(luhnCheck("")).toBe(false)
})
