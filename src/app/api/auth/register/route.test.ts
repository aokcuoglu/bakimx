import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test"

const originalRateLimitStore = process.env.RATE_LIMIT_STORE

let createdWorkshopData: Record<string, unknown> | null = null
let transactionCount = 0
let referralCodes = new Map<string, string>()

mock.module("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: async () => null,
      findFirst: async () => ({ email: "owner@example.com", firstName: "Ayşe" }),
    },
    salesAdvisor: { findFirst: async () => null },
    workshop: {
      findUnique: async ({ where }: { where: { id?: string; referralCode?: string } }) => {
        if (where.id) return { name: "Ayşe Oto", email: "owner@example.com" }
        const id = where.referralCode ? referralCodes.get(where.referralCode) : null
        return id ? { id } : null
      },
    },
    communicationLog: { create: async () => ({ id: "communication-log" }) },
    $transaction: async (callback: (tx: Record<string, unknown>) => Promise<unknown>) => {
      transactionCount += 1
      return callback({
        workshop: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            createdWorkshopData = data
            return { id: "workshop-new" }
          },
        },
        technician: { create: async () => ({ id: "technician-owner" }) },
        user: { create: async () => ({ id: "user-owner" }) },
      })
    },
    $queryRaw: async () => [],
    $executeRawUnsafe: async () => 0,
  },
}))

mock.module("@/lib/admin", () => ({ getAdminEmails: () => [] }))

const { POST } = await import("./route")
const { resetRateLimitStateForTests } = await import("@/lib/rate-limit")

const validBody = {
  email: "owner@example.com",
  password: "password1",
  firstName: "Ayşe",
  lastName: "Yılmaz",
  workshopName: "Ayşe Oto",
  phone: "05551112233",
  city: "İstanbul",
  address: "Sanayi Mahallesi",
  taxNumber: "1234567890",
  invoiceTitle: "Ayşe Oto",
  kvkkConsent: true,
  acquisitionSource: "website",
}

function request(body: Record<string, unknown>, ip: string) {
  return new Request("https://www.bakimx.com/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  process.env.RATE_LIMIT_STORE = "memory"
  resetRateLimitStateForTests()
  createdWorkshopData = null
  transactionCount = 0
  referralCodes = new Map()
})

afterAll(() => {
  if (originalRateLimitStore === undefined) {
    delete process.env.RATE_LIMIT_STORE
  } else {
    process.env.RATE_LIMIT_STORE = originalRateLimitStore
  }
})

describe("POST /api/auth/register onboarding and attribution", () => {
  test("rejects sectors that are still marked as coming soon", async () => {
    const response = await POST(
      request({ ...validBody, sector: "mechanical_service" }, "198.51.100.70"),
    )

    expect(response.status).toBe(400)
    expect(transactionCount).toBe(0)
  })

  test("rejects an unknown referral code before creating a workshop", async () => {
    const response = await POST(request({ ...validBody, referralCode: "YOK-2026" }, "198.51.100.71"))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Referans kodu geçerli değil." })
    expect(transactionCount).toBe(0)
  })

  test("stores the referrer and code snapshot and forces the referral acquisition source", async () => {
    referralCodes.set("DAVET-42", "workshop-referrer")

    const response = await POST(
      request({ ...validBody, referralCode: "davet-42" }, "198.51.100.72"),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(createdWorkshopData).toMatchObject({
      acquisitionSource: "referral",
      referredByWorkshopId: "workshop-referrer",
      referralCodeUsed: "DAVET-42",
    })
  })

  test("stores the free onboarding profile without a package selection", async () => {
    const response = await POST(
      request({
        ...validBody,
        sector: "auto_service",
        businessFeatures: ["stock", "fleet"],
        teamSize: "2_5",
        selectedModules: ["customers_vehicles", "work_orders", "stock_parts"],
        setupPreference: "data_migration",
      }, "198.51.100.73"),
    )

    expect(response.status).toBe(200)
    expect(createdWorkshopData).toMatchObject({
      planTier: "pro",
      onboardingProfile: {
        sector: "auto_service",
        businessFeatures: ["stock", "fleet"],
        teamSize: "2_5",
        selectedModules: ["customers_vehicles", "work_orders", "stock_parts"],
        setupPreference: "data_migration",
      },
    })
    expect(createdWorkshopData).not.toHaveProperty("billingCycle")
  })
})
