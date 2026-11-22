import { describe, expect, test } from "bun:test"
import { APP_VERSION } from "./app-version"
import { computeBuildSignature } from "./build-signature"

describe("computeBuildSignature (#776)", () => {
  test("geliştirmede build id okunmaz, imza sabittir", () => {
    let reads = 0
    const readId = () => {
      reads += 1
      return "aynı-klasörde-alınmış-build"
    }

    expect(computeBuildSignature("development", readId)).toBe(`${APP_VERSION}+development`)
    expect(computeBuildSignature(undefined, readId)).toBe(`${APP_VERSION}+development`)
    expect(computeBuildSignature("test", readId)).toBe(`${APP_VERSION}+development`)
    expect(reads).toBe(0)
  })

  test("üretimde build id imzaya girer", () => {
    expect(computeBuildSignature("production", () => "abc123")).toBe(`${APP_VERSION}+abc123`)
  })

  test("üretimde iki farklı build farklı imza verir (bildirim tetiklenir)", () => {
    const a = computeBuildSignature("production", () => "build-a")
    const b = computeBuildSignature("production", () => "build-b")
    expect(a).not.toBe(b)
  })
})
