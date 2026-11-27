import { expect, test } from "bun:test"
import { manualPlanActivationSchema } from "./plan-activation"

test("dönem ya da açık süresiz seçimi kabul edilir", () => {
  expect(manualPlanActivationSchema.safeParse({ cycle: "monthly", indefinite: false }).success).toBe(true)
  expect(manualPlanActivationSchema.safeParse({ cycle: "yearly", indefinite: false }).success).toBe(true)
  expect(manualPlanActivationSchema.safeParse({ indefinite: true }).success).toBe(true)
})

test("seçimsiz, geçersiz ya da çelişkili girdi reddedilir", () => {
  expect(manualPlanActivationSchema.safeParse({}).success).toBe(false)
  expect(manualPlanActivationSchema.safeParse({ indefinite: false }).success).toBe(false)
  expect(manualPlanActivationSchema.safeParse({ cycle: "weekly", indefinite: false }).success).toBe(false)
  expect(manualPlanActivationSchema.safeParse({ cycle: "monthly", indefinite: true }).success).toBe(false)
  // Eski imza: üçüncü parametre durum dizesiydi.
  expect(manualPlanActivationSchema.safeParse("active").success).toBe(false)
  expect(manualPlanActivationSchema.safeParse(undefined).success).toBe(false)
})

test("hata iletisi Türkçe ve alanı gösterir", () => {
  const none = manualPlanActivationSchema.safeParse({ indefinite: false })
  expect(none.success ? "" : none.error.issues[0]?.message).toBe("Dönem seçin (aylık / yıllık) ya da süresiz erişimi işaretleyin.")
  const both = manualPlanActivationSchema.safeParse({ cycle: "yearly", indefinite: true })
  expect(both.success ? "" : both.error.issues[0]?.message).toBe("Süresiz erişimde dönem seçilemez.")
})
