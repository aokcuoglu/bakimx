import { expect, test } from "bun:test"
import { formatElapsed } from "./elapsed"

test("bir saatin altı m:ss", () => {
  expect(formatElapsed(0)).toBe("0:00")
  expect(formatElapsed(5_000)).toBe("0:05")
  expect(formatElapsed(65_000)).toBe("1:05")
  expect(formatElapsed(59 * 60_000 + 59_999)).toBe("59:59")
})

test("bir saat ve üstü h:mm:ss", () => {
  expect(formatElapsed(3_600_000)).toBe("1:00:00")
  expect(formatElapsed(3_600_000 + 61_000)).toBe("1:01:01")
})

test("negatif süre 0 olur", () => {
  expect(formatElapsed(-5_000)).toBe("0:00")
})
