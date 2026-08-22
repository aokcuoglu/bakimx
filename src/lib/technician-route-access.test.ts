import { describe, test, expect } from "bun:test"
import fs from "node:fs"
import path from "node:path"
import {
  TECHNICIAN_ALLOWED_PREFIXES,
  TECHNICIAN_RESTRICTED_ROLES,
  getAppHomeRoute,
  isTechnicianRestrictedRole,
  isRouteAllowedForTechnician,
} from "./technician-route-access"

/**
 * BAK-106: Usta/çırak deny-by-default rota kısıtlaması.
 *
 * Bu test src/app/(app)/ altındaki tüm rota dizinlerinin TECHNICIAN_ALLOWED_PREFIXES
 * veya TECHNICIAN_DENIED_ROUTES listesinde olmasını zorlar. Yeni bir dizin eklenip
 * listeye eklenmezse test kırmızıya düşer — böylece yeni bir ekran usta/çırağa
 * yanlışlıkla açık kalmaz.
 */

const APP_DIR = path.resolve(__dirname, "../app/(app)")

const TECHNICIAN_DENIED_ROUTES: string[] = [
  "/analytics",
  "/appointments",
  "/bakimx-orders",
  "/billing",
  "/calendar",
  "/cash",
  "/cashbox",
  "/communications",
  "/customers",
  "/dashboard",
  "/intakes",
  "/inventory",
  "/orders",
  "/parts",
  "/purchases",
  "/quotes",
  "/reminders",
  "/reports",
  "/settings",
  "/smart-capture",
  "/suppliers",
  "/vehicles",
  "/workshop",
]

function getAppRouteGroups(): string[] {
  const entries = fs.readdirSync(APP_DIR, { withFileTypes: true })
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => `/${e.name}`)
    .sort()
}

describe("technician-route-access", () => {
  test("every (app) route group is classified as allowed or denied", () => {
    const routeGroups = getAppRouteGroups()
    const classified = new Set([
      ...TECHNICIAN_ALLOWED_PREFIXES,
      ...TECHNICIAN_DENIED_ROUTES,
    ])

    const unclassified = routeGroups.filter((r) => !classified.has(r))
    expect(unclassified).toEqual([])
  })

  test("allowed prefixes exist as directories", () => {
    for (const prefix of TECHNICIAN_ALLOWED_PREFIXES) {
      const dirName = prefix.slice(1)
      const dirPath = path.join(APP_DIR, dirName)
      expect(fs.existsSync(dirPath)).toBe(true)
    }
  })

  test("denied routes exist as directories", () => {
    for (const route of TECHNICIAN_DENIED_ROUTES) {
      const dirName = route.slice(1)
      const dirPath = path.join(APP_DIR, dirName)
      expect(fs.existsSync(dirPath)).toBe(true)
    }
  })

  test("isTechnicianRestrictedRole identifies correct roles", () => {
    expect(isTechnicianRestrictedRole("usta")).toBe(true)
    expect(isTechnicianRestrictedRole("cirak")).toBe(true)
    expect(isTechnicianRestrictedRole("staff")).toBe(true)
    expect(isTechnicianRestrictedRole("owner")).toBe(false)
    expect(isTechnicianRestrictedRole("manager")).toBe(false)
    expect(isTechnicianRestrictedRole(undefined)).toBe(false)
    expect(isTechnicianRestrictedRole(null)).toBe(false)
  })

  test("isRouteAllowedForTechnician permits only allowed prefixes", () => {
    expect(isRouteAllowedForTechnician("/technician")).toBe(true)
    expect(isRouteAllowedForTechnician("/technician/123")).toBe(true)
    expect(isRouteAllowedForTechnician("/account")).toBe(true)
    expect(isRouteAllowedForTechnician("/account/settings")).toBe(true)

    expect(isRouteAllowedForTechnician("/dashboard")).toBe(false)
    expect(isRouteAllowedForTechnician("/orders")).toBe(false)
    expect(isRouteAllowedForTechnician("/settings")).toBe(false)
    expect(isRouteAllowedForTechnician("/customers")).toBe(false)
    expect(isRouteAllowedForTechnician("/parts")).toBe(false)
    expect(isRouteAllowedForTechnician("/")).toBe(false)
  })

  test("getAppHomeRoute selects the landing page for each role", () => {
    expect(getAppHomeRoute("usta")).toBe("/technician")
    expect(getAppHomeRoute("cirak")).toBe("/technician")
    expect(getAppHomeRoute("staff")).toBe("/technician")
    expect(getAppHomeRoute("owner")).toBe("/dashboard")
    expect(getAppHomeRoute("manager")).toBe("/dashboard")
    expect(getAppHomeRoute(undefined)).toBe("/dashboard")
  })

  test("TECHNICIAN_RESTRICTED_ROLES matches expected roles", () => {
    expect([...TECHNICIAN_RESTRICTED_ROLES].sort()).toEqual(["cirak", "staff", "usta"])
  })
})
