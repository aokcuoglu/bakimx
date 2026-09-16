import { beforeEach, describe, expect, mock, test } from "bun:test"

type Identity = {
  id: string
  isActive: boolean
  dashboardTourCompletedAt: Date | null
  impersonatorAdminId?: string
}

let identity: Identity | null
let updated: unknown = null

mock.module("@/lib/auth", () => ({
  getCurrentUser: async () => identity,
}))
mock.module("@/lib/db", () => ({
  prisma: {
    user: {
      update: async (args: unknown) => {
        updated = args
        return { id: "u1" }
      },
    },
  },
}))

const { POST } = await import("./route")

beforeEach(() => {
  identity = {
    id: "u1",
    isActive: true,
    dashboardTourCompletedAt: null,
  }
  updated = null
})

describe("POST /api/account/dashboard-tour", () => {
  test("requires an active session", async () => {
    identity = null
    expect((await POST()).status).toBe(401)
    identity = { id: "u1", isActive: false, dashboardTourCompletedAt: null }
    expect((await POST()).status).toBe(401)
    expect(updated).toBeNull()
  })

  test("blocks impersonation", async () => {
    identity!.impersonatorAdminId = "admin"
    expect((await POST()).status).toBe(403)
    expect(updated).toBeNull()
  })

  test("sets dashboardTourCompletedAt when unset", async () => {
    const response = await POST()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(updated).toMatchObject({
      where: { id: "u1" },
      data: { dashboardTourCompletedAt: expect.any(Date) },
    })
  })

  test("is idempotent when already completed", async () => {
    identity!.dashboardTourCompletedAt = new Date("2026-01-01")
    const response = await POST()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(updated).toBeNull()
  })
})
