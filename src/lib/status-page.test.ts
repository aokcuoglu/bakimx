import { expect, test } from "bun:test"
import { deriveOverallStatus } from "@/lib/status-page"

test("aktif olay yokken durum operational", () => {
  expect(deriveOverallStatus([])).toBe("operational")
})

test("tek aktif olay kendi ciddiyetini verir", () => {
  expect(deriveOverallStatus(["degraded"])).toBe("degraded")
})

test("birden çok aktif olayda EN YÜKSEK ciddiyet kazanır, sıradan bağımsız", () => {
  expect(deriveOverallStatus(["degraded", "major_outage"])).toBe("major_outage")
  expect(deriveOverallStatus(["major_outage", "degraded"])).toBe("major_outage")
})
