import { beforeEach, describe, expect, mock, test } from "bun:test"

const requireAuth = mock(() => Promise.resolve({ role: "owner", workshopId: "workshop-1" }))
const findMany = mock(() => Promise.resolve([] as unknown[]))

mock.module("@/lib/auth", () => ({ requireAuth }))
mock.module("@/lib/db", () => ({ prisma: { serviceOrder: { findMany } } }))

const { GET } = await import("./route")

describe("GET /api/search/orders", () => {
  beforeEach(() => {
    requireAuth.mockReset()
    findMany.mockReset()
    requireAuth.mockResolvedValue({ role: "owner", workshopId: "workshop-1" })
    findMany.mockResolvedValue([])
  })

  test("restricted role receives no order records", async () => {
    requireAuth.mockResolvedValue({ role: "usta", workshopId: "workshop-1" })
    const response = await GET(new Request("http://localhost/api/search/orders?q=BX"))
    expect(await response.json()).toEqual({ results: [] })
    expect(findMany).not.toHaveBeenCalled()
  })

  test("search stays within the current workshop and returns destinations", async () => {
    findMany.mockResolvedValue([{
      id: "order-1",
      workOrderNo: "BX-42",
      intakeForm: {
        vehicle: { plate: "34 ABC 123" },
        customer: { id: "customer-1", firstName: "Ayşe", lastName: "Yılmaz", fullName: null, companyName: null, type: "individual", phone: "555" },
      },
    }])
    const response = await GET(new Request("http://localhost/api/search/orders?q=BX"))
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workshopId: "workshop-1" }),
      take: 8,
    }))
    expect(await response.json()).toEqual({
      results: [{ id: "order-1", label: "Araç kabul BX-42", sublabel: "34 ABC 123 · Ayşe Yılmaz" }],
    })
  })
})
