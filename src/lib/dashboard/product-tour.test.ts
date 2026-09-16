import { describe, expect, test } from "bun:test"
import {
  getDashboardTourSteps,
  nextAvailableStepIndex,
  tourTargetSelector,
  type TourStepDef,
} from "@/lib/dashboard/product-tour"

describe("dashboard product tour config", () => {
  test("desktop and mobile each expose five steps", () => {
    expect(getDashboardTourSteps(false)).toHaveLength(5)
    expect(getDashboardTourSteps(true)).toHaveLength(5)
  })

  test("first step is a target-free intro", () => {
    const intro = getDashboardTourSteps(false)[0]
    expect(intro?.id).toBe("intro")
    expect(intro?.targets).toEqual([])
  })

  test("mobile orders step targets the bottom nav", () => {
    const orders = getDashboardTourSteps(true).find((s) => s.id === "orders")
    expect(orders?.targets).toEqual(["mobile-nav-orders"])
  })

  test("desktop orders step targets the sidebar", () => {
    const orders = getDashboardTourSteps(false).find((s) => s.id === "orders")
    expect(orders?.targets).toEqual(["nav-orders"])
  })

  test("first-order step falls back through welcome anchors", () => {
    const last = getDashboardTourSteps(false).at(-1)
    expect(last?.targets).toEqual(["first-order", "welcome-cta", "welcome-banner"])
  })

  test("tourTargetSelector builds data-tour attribute", () => {
    expect(tourTargetSelector("create-center")).toBe('[data-tour="create-center"]')
  })
})

describe("nextAvailableStepIndex", () => {
  const steps: TourStepDef[] = [
    { id: "a", title: "A", description: "", targets: ["welcome-banner"] },
    { id: "b", title: "B", description: "", targets: ["nav-orders"] },
    { id: "c", title: "C", description: "", targets: ["create-center"] },
  ]

  test("skips missing targets forward", () => {
    const has = (s: TourStepDef) => s.id !== "b"
    expect(nextAvailableStepIndex(steps, 0, 1, has)).toBe(0)
    expect(nextAvailableStepIndex(steps, 1, 1, has)).toBe(2)
  })

  test("skips missing targets backward", () => {
    const has = (s: TourStepDef) => s.id !== "b"
    expect(nextAvailableStepIndex(steps, 2, -1, has)).toBe(2)
    expect(nextAvailableStepIndex(steps, 1, -1, has)).toBe(0)
  })

  test("returns null when none remain", () => {
    expect(nextAvailableStepIndex(steps, 0, 1, () => false)).toBeNull()
  })
})
