import { expect, test } from "bun:test"
import { isOutdatedBuild, parseVersionPayload } from "./app-version"

const LOADED = "0.12.0+abc123"

test("aynı imzada bildirim tetiklenmez", () => {
  expect(isOutdatedBuild(LOADED, { version: "0.12.0", signature: LOADED })).toBe(false)
})

test("build id değiştiğinde bildirim tetiklenir (sürüm aynı kalsa bile)", () => {
  expect(isOutdatedBuild(LOADED, { version: "0.12.0", signature: "0.12.0+def456" })).toBe(true)
})

test("sürüm arttığında bildirim tetiklenir", () => {
  expect(isOutdatedBuild(LOADED, { version: "0.13.0", signature: "0.13.0+abc123" })).toBe(true)
})

test("bozuk/eksik yanıtlarda sessiz kalır (yanlış pozitif yenileme yok)", () => {
  for (const data of [
    null,
    undefined,
    "0.13.0",
    42,
    {},
    { version: "0.13.0" },
    { signature: "0.13.0+abc" },
    { version: "0.13.0", signature: "" },
    { version: 13, signature: 456 },
  ]) {
    expect(isOutdatedBuild(LOADED, data)).toBe(false)
  }
})

test("istemci imzası bilinmiyorsa sessiz kalır", () => {
  expect(isOutdatedBuild("", { version: "0.13.0", signature: "0.13.0+def" })).toBe(false)
})

test("parseVersionPayload yalnızca tam yanıtı kabul eder", () => {
  expect(parseVersionPayload({ version: "0.12.0", signature: "0.12.0+abc" })).toEqual({
    version: "0.12.0",
    signature: "0.12.0+abc",
  })
  expect(parseVersionPayload({ version: "0.12.0", signature: null })).toBeNull()
  expect(parseVersionPayload([])).toBeNull()
})
