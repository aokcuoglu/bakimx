import { beforeEach, describe, expect, mock, test } from "bun:test"

const requireAuth = mock(() => Promise.resolve(null as unknown))
const findActiveMembership = mock(() => Promise.resolve(null as unknown))
const activateWorkshopForUser = mock(() => Promise.resolve())
const establishSession = mock(() => Promise.resolve())

mock.module("@/lib/auth", () => ({ requireAuth }))
mock.module("@/lib/membership", () => ({
  findActiveMembership,
  activateWorkshopForUser,
}))
mock.module("@/lib/session", () => ({ establishSession }))

const { POST } = await import("./route")

describe("POST /api/branches/switch", () => {
  beforeEach(() => {
    requireAuth.mockReset()
    findActiveMembership.mockReset()
    activateWorkshopForUser.mockReset()
    establishSession.mockReset()
  })

  test("rejects non-member workshop", async () => {
    requireAuth.mockResolvedValue({
      id: "u1",
      workshopId: "w1",
      role: "owner",
      impersonatorAdminId: undefined,
    })
    findActiveMembership.mockResolvedValue(null)

    const res = await POST(
      new Request("http://localhost/api/branches/switch", {
        method: "POST",
        body: JSON.stringify({ workshopId: "w2" }),
      }),
    )
    expect(res.status).toBe(403)
    expect(activateWorkshopForUser).not.toHaveBeenCalled()
  })

  test("switches when membership exists", async () => {
    requireAuth.mockResolvedValue({
      id: "u1",
      workshopId: "w1",
      role: "owner",
      impersonatorAdminId: undefined,
    })
    findActiveMembership.mockResolvedValue({
      role: "owner",
      workshop: {
        name: "Şube 2",
        kind: "customer",
        approvalStatus: "approved",
      },
    })

    const res = await POST(
      new Request("http://localhost/api/branches/switch", {
        method: "POST",
        body: JSON.stringify({ workshopId: "w2" }),
      }),
    )
    expect(res.status).toBe(200)
    expect(activateWorkshopForUser).toHaveBeenCalledWith({
      userId: "u1",
      workshopId: "w2",
      role: "owner",
    })
    expect(establishSession).toHaveBeenCalledWith("u1", "w2", "owner")
  })

  test("blocks impersonation", async () => {
    requireAuth.mockResolvedValue({
      id: "u1",
      workshopId: "w1",
      role: "owner",
      impersonatorAdminId: "admin",
    })

    const res = await POST(
      new Request("http://localhost/api/branches/switch", {
        method: "POST",
        body: JSON.stringify({ workshopId: "w2" }),
      }),
    )
    expect(res.status).toBe(403)
  })
})
