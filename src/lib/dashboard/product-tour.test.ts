import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import {
  getDashboardTourSteps,
  nextAvailableStepIndex,
  tourTargetSelector,
  type TourStepDef,
} from "@/lib/dashboard/product-tour"

describe("dashboard product tour config", () => {
  test("desktop exposes four steps and mobile exposes three", () => {
    expect(getDashboardTourSteps(false)).toHaveLength(4)
    expect(getDashboardTourSteps(true)).toHaveLength(3)
  })

  test("first step is a target-free intro", () => {
    const intro = getDashboardTourSteps(false)[0]
    expect(intro?.id).toBe("intro")
    expect(intro?.targets).toEqual([])
  })

  test("mobile tour has no bottom-nav steps (the mobile tab bar was removed)", () => {
    const ids = getDashboardTourSteps(true).map((s) => s.id)
    expect(ids).toEqual(["intro", "search", "first-order"])
  })

  test("desktop orders step targets the sidebar", () => {
    const orders = getDashboardTourSteps(false).find((s) => s.id === "orders")
    expect(orders?.targets).toEqual(["nav-orders"])
  })

  test("search targets the sidebar on desktop and its trigger on mobile", () => {
    expect(getDashboardTourSteps(false).find((s) => s.id === "search")?.targets).toEqual(["global-search"])
    expect(getDashboardTourSteps(true).find((s) => s.id === "search")?.targets).toEqual(["sidebar-trigger"])
  })

  test("first-order step falls back through welcome anchors", () => {
    const last = getDashboardTourSteps(false).at(-1)
    expect(last?.targets).toEqual(["first-order", "welcome-cta", "welcome-banner"])
  })

  // Turun son adımının çapası Genel Bakış'taki "İlk işinize başlayın" kartı.
  // Kart eskiden yalnız Lite atölyede çıkıyordu; artık iş emri olmayan her
  // atölye görür (#830).
  test("first-order card is shown to every workshop without a work order", () => {
    const source = readFileSync(join(process.cwd(), "src/app/(app)/dashboard/page.tsx"), "utf8")
    expect(source).toContain('data-tour="first-order"')
    expect(source).toContain("const needsFirstOrder = !firstOrder")
    expect(source).not.toContain('accessTier === "lite"')
    expect(source).not.toContain("Kurulum tercihleriniz kaydedildi")
  })

  // Hedefsiz adım turu sessizce atlatır (#930: create-center). Her adım
  // çapasının değeri, tur dosyası ve testler dışında bir kaynak dosyada
  // (data-tour / tourId / NAV_TOUR_ATTR) geçmek zorunda.
  test("every tour target id is anchored somewhere in rendered source", () => {
    const root = join(process.cwd(), "src")
    const files = (readdirSync(root, { recursive: true }) as string[])
      .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
      .filter((f) => !f.endsWith("lib/dashboard/product-tour.ts"))
    const corpus = files.map((f) => readFileSync(join(root, f), "utf8")).join("\n")
    const ids = new Set(
      [true, false].flatMap((m) => getDashboardTourSteps(m).flatMap((s) => s.targets)),
    )
    for (const id of ids) {
      expect(corpus.includes(`"${id}"`) || corpus.includes(`data-tour="${id}"`)).toBe(true)
    }
  })

  test("tourTargetSelector builds data-tour attribute", () => {
    expect(tourTargetSelector("global-search")).toBe('[data-tour="global-search"]')
  })
})

describe("nextAvailableStepIndex", () => {
  const steps: TourStepDef[] = [
    { id: "a", title: "A", description: "", targets: ["welcome-banner"] },
    { id: "b", title: "B", description: "", targets: ["nav-orders"] },
    { id: "c", title: "C", description: "", targets: ["sidebar-trigger"] },
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
