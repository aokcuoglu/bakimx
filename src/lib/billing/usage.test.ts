import { expect, test } from "bun:test"
import { summarizeSeatUsage, usagePercent, usageTone } from "@/lib/billing/usage"

test("kullanım yüzdesi aralık dışında taşmaz", () => {
  expect(usagePercent(7, 10)).toBe(70)
  expect(usagePercent(12, 10)).toBe(100)
  expect(usagePercent(1, 0)).toBe(0)
})

test("yüzde 70 uyarı, yüzde 90 kritik eşiğidir", () => {
  expect(usageTone(69, 100)).toBe("normal")
  expect(usageTone(70, 100)).toBe("warning")
  expect(usageTone(89, 100)).toBe("warning")
  expect(usageTone(90, 100)).toBe("critical")
})

test("koltuk kullanımı aktif kullanıcı, canlı davet ve ek koltuğu doğru toplar", () => {
  expect(
    summarizeSeatUsage({ activeUsers: 3, pendingInvites: 2, includedSeats: 5, extraSeats: 3 }),
  ).toEqual({
    activeUsers: 3,
    pendingInvites: 2,
    includedSeats: 5,
    extraSeats: 3,
    used: 5,
    limit: 8,
  })
})
