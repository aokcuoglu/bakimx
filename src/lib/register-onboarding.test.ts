import { describe, expect, test } from "bun:test"
import {
  BASE_RECOMMENDED_MODULES,
  REGISTER_MODULE_IDS,
  recommendedRegisterModules,
} from "@/lib/register-onboarding"

describe("registration onboarding recommendations", () => {
  test("starts an auto service with the core modules", () => {
    expect(recommendedRegisterModules([])).toEqual(BASE_RECOMMENDED_MODULES)
  })

  test("adds stock and supplier modules for a workshop that holds stock", () => {
    const result = recommendedRegisterModules(["stock"])
    expect(result).toContain("stock_parts")
    expect(result).toContain("suppliers")
  })

  test("deduplicates overlapping answers and keeps catalog order", () => {
    const result = recommendedRegisterModules(["fleet", "pickup_delivery", "virtual_pos"])
    expect(result.filter((moduleId) => moduleId === "communications")).toHaveLength(1)
    expect(result).toEqual(REGISTER_MODULE_IDS.filter((moduleId) => result.includes(moduleId)))
  })
})
