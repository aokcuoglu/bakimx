import { expect, test } from "bun:test"
import { hashFailAlertKey } from "./hash-fail-alert"

test("hashFailAlertKey: aynı saat içindeki iki tarih aynı anahtarı üretir (saatlik dedup)", () => {
  const a = new Date("2026-07-06T14:00:00.000Z")
  const b = new Date("2026-07-06T14:59:59.999Z")
  expect(hashFailAlertKey(a)).toBe(hashFailAlertKey(b))
  expect(hashFailAlertKey(a)).toBe("hash_fail_alert:2026-07-06T14")
})

test("hashFailAlertKey: farklı saatler farklı anahtar üretir (yeni saat → yeni alert hakkı)", () => {
  const a = new Date("2026-07-06T14:59:59.999Z")
  const b = new Date("2026-07-06T15:00:00.000Z")
  expect(hashFailAlertKey(a)).not.toBe(hashFailAlertKey(b))
})

test("hashFailAlertKey: gün/ay sınırında da doğru saat anahtarı üretir (UTC)", () => {
  expect(hashFailAlertKey(new Date("2026-07-31T23:30:00.000Z"))).toBe("hash_fail_alert:2026-07-31T23")
  expect(hashFailAlertKey(new Date("2026-08-01T00:00:00.000Z"))).toBe("hash_fail_alert:2026-08-01T00")
})
