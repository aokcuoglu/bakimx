import { expect, test } from "bun:test"
import { isCardPaymentBlocked, misconfigAlertKey } from "./misconfig-alert"

test("isCardPaymentBlocked: prod build + TAMI eksik → kart akışı kapalı (TAMI_ENV unset olsa bile)", () => {
  // Gerçek hata modu: prod .env'e TAMI bloğu hiç girmedi — TAMI_ENV de unset,
  // config "sandbox"a düşer. Guard NODE_ENV tabanlı olduğu için yine kapanır.
  expect(isCardPaymentBlocked({ nodeEnv: "production", tamiConfigured: false })).toBe(true)
})

test("isCardPaymentBlocked: prod build + TAMI tam yapılandırılmış → akış açık", () => {
  expect(isCardPaymentBlocked({ nodeEnv: "production", tamiConfigured: true })).toBe(false)
})

test("isCardPaymentBlocked: local dev/test mock ile çalışmaya devam eder", () => {
  expect(isCardPaymentBlocked({ nodeEnv: "development", tamiConfigured: false })).toBe(false)
  expect(isCardPaymentBlocked({ nodeEnv: "test", tamiConfigured: false })).toBe(false)
  expect(isCardPaymentBlocked({ nodeEnv: undefined, tamiConfigured: false })).toBe(false)
})

test("misconfigAlertKey: aynı gün içindeki iki tarih aynı anahtarı üretir (günlük dedup)", () => {
  const a = new Date("2026-07-06T00:00:00.000Z")
  const b = new Date("2026-07-06T23:59:59.999Z")
  expect(misconfigAlertKey(a)).toBe(misconfigAlertKey(b))
  expect(misconfigAlertKey(a)).toBe("tami_misconfig_alert:2026-07-06")
})

test("misconfigAlertKey: farklı günler farklı anahtar üretir (yeni gün → yeni alert hakkı)", () => {
  const a = new Date("2026-07-06T23:59:59.999Z")
  const b = new Date("2026-07-07T00:00:00.000Z")
  expect(misconfigAlertKey(a)).not.toBe(misconfigAlertKey(b))
})
