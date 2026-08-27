import { describe, expect, test } from "bun:test"
import {
  INTERNAL_OPERATIONS_WORKSHOP_ID,
  isCustomerWorkshopKind,
} from "@/lib/workshop-kind"

describe("workshop kind boundary", () => {
  test("yalnız customer tenant yüzeyine geçebilir", () => {
    expect(isCustomerWorkshopKind("customer")).toBe(true)
    expect(isCustomerWorkshopKind("internal")).toBe(false)
    expect(isCustomerWorkshopKind(undefined)).toBe(false)
    expect(isCustomerWorkshopKind(null)).toBe(false)
    expect(isCustomerWorkshopKind("unknown")).toBe(false)
  })

  test("iç operasyon kimliği sabittir", () => {
    expect(INTERNAL_OPERATIONS_WORKSHOP_ID).toBe("bakimx-internal-operations")
  })
})
