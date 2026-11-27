import { expect, test } from "bun:test"
import { pickAccountWorkshopId } from "@/lib/billing/account"

test("en eski atölye hesap atölyesidir; eşitlikte küçük id", () => {
  const t = (s: string) => new Date(s)
  expect(pickAccountWorkshopId([{ id: "b", createdAt: t("2026-02-01") }, { id: "a", createdAt: t("2026-03-01") }])).toBe("b")
  expect(pickAccountWorkshopId([{ id: "z", createdAt: t("2026-02-01") }, { id: "c", createdAt: t("2026-02-01") }])).toBe("c")
  expect(() => pickAccountWorkshopId([])).toThrow()
})
