import { expect, test } from "bun:test"
import { ownerSwitchMessage } from "./owner-switch-message"

test("sahip adı varsa mesajda geçer", () => {
  expect(ownerSwitchMessage("Ayşe Yılmaz")).toBe("Bu araç Ayşe Yılmaz adına kayıtlı; müşteri güncellendi.")
})

test("ad yoksa ya da boşsa nötr mesaj", () => {
  const neutral = "Bu araç başka bir müşteriye kayıtlı; müşteri güncellendi."
  expect(ownerSwitchMessage()).toBe(neutral)
  expect(ownerSwitchMessage("  ")).toBe(neutral)
})
