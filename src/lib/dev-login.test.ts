import { test, expect } from "bun:test"
import { isDevLoginAllowed, safeRedirectPath } from "./dev-login"

test("yalnız development + localhost açıktır", () => {
  expect(isDevLoginAllowed("development", "localhost:3000")).toBe(true)
  expect(isDevLoginAllowed("development", "127.0.0.1:3201")).toBe(true)
  expect(isDevLoginAllowed("development", "mac.local")).toBe(true)
})

test("production'da her zaman kapalıdır", () => {
  expect(isDevLoginAllowed("production", "localhost:3000")).toBe(false)
  expect(isDevLoginAllowed("production", "app.bakimx.com")).toBe(false)
  expect(isDevLoginAllowed(undefined, "localhost")).toBe(false)
})

test("development olsa bile uzak host kapalıdır", () => {
  expect(isDevLoginAllowed("development", "app-dev.bakimx.com")).toBe(false)
  expect(isDevLoginAllowed("development", "bakimx.com")).toBe(false)
  expect(isDevLoginAllowed("development", null)).toBe(false)
})

test("yönlendirme yalnız aynı origin yoluna izin verir", () => {
  expect(safeRedirectPath("/technician/orders/abc")).toBe("/technician/orders/abc")
  expect(safeRedirectPath(null)).toBe("/dashboard")
  expect(safeRedirectPath("//evil.com")).toBe("/dashboard")
  expect(safeRedirectPath("https://evil.com")).toBe("/dashboard")
  expect(safeRedirectPath("/\\evil.com")).toBe("/dashboard")
})
