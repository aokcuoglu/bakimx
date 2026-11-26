import { readFileSync } from "node:fs"
import { describe, expect, test } from "bun:test"
import { extraSeatsSchema } from "./workshop-addons"

// `setWorkshopExtraSeats` (admin) bu şemayla doğrular; koltuk kaydı paket
// etkinleştirmeden ayrıdır (#939).
describe("extraSeatsSchema", () => {
  test("0–500 tam sayıyı kabul eder", () => {
    expect(extraSeatsSchema.safeParse(0).success).toBe(true)
    expect(extraSeatsSchema.safeParse(500).success).toBe(true)
  })

  test("negatif, kesirli, aşırı ve sayı olmayan değeri reddeder", () => {
    for (const bad of [-1, 1.5, 501, "3", null, Number.NaN]) {
      expect(extraSeatsSchema.safeParse(bad).success).toBe(false)
    }
  })
})

describe("koltuk kaydı ile paket etkinleştirme ayrımı (#939)", () => {
  const actions = readFileSync("src/app/admin/actions.ts", "utf8")
  const ui = readFileSync("src/app/admin/workshop-actions.tsx", "utf8")

  test("setWorkshopExtraSeats admin yetkisi ister, audit yazar, paketi değiştirmez", () => {
    const body = actions.slice(actions.indexOf("export async function setWorkshopExtraSeats"), actions.indexOf("/**", actions.indexOf("export async function setWorkshopExtraSeats")))
    expect(body).toContain('requireAdminCapability("manageWorkshops")')
    expect(body).toContain('"admin_extra_seats_set"')
    expect(body).not.toContain("planTier")
  })

  test("arayüzde koltuk kaydı activateWorkshopPlan çağırmaz", () => {
    const seatCall = ui.slice(ui.indexOf("setWorkshopExtraSeats(w.id, seats)"))
    expect(seatCall.slice(0, 120)).not.toContain("activateWorkshopPlan")
    expect(ui).not.toMatch(/setWorkshopExtraSeats\([^)]*\)[\s\S]{0,80}activateWorkshopPlan/)
  })
})
