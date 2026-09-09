import { test, expect } from "bun:test"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

test("delivery OTP server flow preserves gates and fails closed (isolated module mocks)", () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("./test-fixtures/delivery-otp-flow.js", import.meta.url))], { encoding: "utf8" })
  expect(result.stderr).toBe("")
  expect(result.status).toBe(0)
  expect(result.stdout).toContain("delivery flow passed")
})
