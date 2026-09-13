import { beforeEach, describe, expect, mock, test } from "bun:test"
import { PlanWriteLockedError } from "@/lib/plan"

let identity: { role: string; workshopId: string; isActive: boolean; impersonatorAdminId?: string } | null
let gateError: Error | null = null
let updateCount = 1
let written: unknown = null
let permission: string | null = null

mock.module("@/lib/auth", () => ({
  getCurrentUser: async () => identity,
  PasswordChangeRequiredError: class PasswordChangeRequiredError extends Error {},
  requireWritableWorkshop: async (requested: string) => {
    permission = requested
    if (gateError) throw gateError
    return { user: identity }
  },
}))
mock.module("@/lib/db", () => ({
  prisma: { workshop: { updateMany: async (args: unknown) => { written = args; return { count: updateCount } } } },
}))

const { POST } = await import("./route")
const profile = {
  sector: "mechanical_service",
  businessFeatures: ["stock"],
  teamSize: "2_5",
  selectedModules: ["customers_vehicles", "stock_parts"],
  setupPreference: "self_service",
}
const request = (body: unknown = profile) => new Request("http://localhost/api/onboarding", {
  method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
})

beforeEach(() => {
  identity = { role: "owner", workshopId: "own-workshop", isActive: true }
  gateError = null
  updateCount = 1
  written = null
  permission = null
})

describe("post-registration onboarding", () => {
  test("requires an active owner session", async () => {
    identity = null
    expect((await POST(request())).status).toBe(401)
    identity = { role: "owner", workshopId: "own-workshop", isActive: false }
    expect((await POST(request())).status).toBe(401)
    identity = { role: "manager", workshopId: "own-workshop", isActive: true }
    expect((await POST(request())).status).toBe(403)
    expect(written).toBeNull()
  })

  test("blocks impersonation and locked plans", async () => {
    identity!.impersonatorAdminId = "admin"
    expect((await POST(request())).status).toBe(403)
    delete identity!.impersonatorAdminId
    gateError = new PlanWriteLockedError("Plan kilitli", "pending")
    expect((await POST(request())).status).toBe(403)
    expect(written).toBeNull()
  })

  test("rejects incomplete, unavailable and privilege-changing input", async () => {
    for (const body of [{}, { ...profile, sector: "upholstery" }, { ...profile, selectedModules: [] }, { ...profile, workshopId: "other-workshop" }, { ...profile, planTier: "premium" }]) {
      expect((await POST(request(body))).status).toBe(400)
    }
    expect(written).toBeNull()
  })

  test("completes only the authenticated tenant pending profile", async () => {
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(permission).toBe("settings.manage")
    expect(written).toEqual({
      where: { id: "own-workshop", onboardingProfile: { path: ["status"], equals: "pending" } },
      data: { onboardingProfile: { status: "completed", ...profile } },
    })
  })

  test("does not overwrite completed or legacy profiles", async () => {
    updateCount = 0
    expect((await POST(request())).status).toBe(409)
  })
})
