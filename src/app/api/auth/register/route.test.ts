import { afterAll, beforeEach, describe, expect, mock, test } from "bun:test"
import { hashSalesRegistrationToken } from "@/lib/sales/registration-link"

const originalRateLimitStore = process.env.RATE_LIMIT_STORE

let createdWorkshopData: Record<string, unknown> | null = null
let transactionCount = 0
let referralCodes = new Map<string, string>()
let transactionQueue = Promise.resolve()
let salesLink: {
  tokenHash: string
  advisorId: string
  createdById: string
  expiresAt: Date
  usedAt: Date | null
  revokedAt: Date | null
  workshopId: string | null
  advisorDisabledAt: Date | null
  advisorUserActive: boolean
  lead: {
    id: string
    source: "field" | "public_demo_request" | "customer_referral"
    status: "proposal" | "onboarding" | "won" | "lost"
    advisorId: string | null
    workshopId: string | null
    attributionFrozenAt: Date | null
  }
} | null = null
let createdWorkshopCount = 0
let createdOwnerCount = 0
let convertedLeadData: Record<string, unknown> | null = null
let completedSalesActivity: Record<string, unknown> | null = null
let cancelledTaskCount = 0
let failLeadConversion = false
let existingUser: {
  password: string
  workshop: { id: string; approvalStatus: "pending"; trialStartedAt: Date | null }
} | null = null

mock.module("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: async () => existingUser,
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
      const run = transactionQueue.then(async () => {
        transactionCount += 1
        const snapshot = {
          createdWorkshopData,
          createdWorkshopCount,
          createdOwnerCount,
          convertedLeadData,
          completedSalesActivity,
          cancelledTaskCount,
          linkUsedAt: salesLink?.usedAt ?? null,
          linkWorkshopId: salesLink?.workshopId ?? null,
        }
        try {
          return await callback({
            salesRegistrationLink: {
              findUnique: async ({ where }: { where: { tokenHash: string } }) => {
                if (!salesLink || where.tokenHash !== salesLink.tokenHash) return null
                return {
                  id: "sales-link",
                  advisorId: salesLink.advisorId,
                  createdById: salesLink.createdById,
                  expiresAt: salesLink.expiresAt,
                  usedAt: salesLink.usedAt,
                  revokedAt: salesLink.revokedAt,
                  lead: { ...salesLink.lead },
                  advisor: {
                    disabledAt: salesLink.advisorDisabledAt,
                    user: { isActive: salesLink.advisorUserActive },
                  },
                }
              },
              updateMany: async () => {
                if (!salesLink || salesLink.usedAt || salesLink.revokedAt || salesLink.expiresAt <= new Date()) {
                  return { count: 0 }
                }
                salesLink.usedAt = new Date()
                return { count: 1 }
              },
              update: async ({ data }: { data: { workshopId: string } }) => {
                if (salesLink) salesLink.workshopId = data.workshopId
                return { id: "sales-link" }
              },
            },
            workshop: {
              create: async ({ data }: { data: Record<string, unknown> }) => {
                createdWorkshopData = data
                createdWorkshopCount += 1
                return { id: "workshop-new" }
              },
            },
            technician: { create: async () => ({ id: "technician-owner" }) },
            user: {
              create: async () => {
                createdOwnerCount += 1
                return { id: "user-owner" }
              },
            },
            salesLead: {
              updateMany: async ({ data }: { data: Record<string, unknown> }) => {
                if (failLeadConversion) return { count: 0 }
                convertedLeadData = data
                if (salesLink) {
                  salesLink.lead.workshopId = data.workshopId as string
                  salesLink.lead.status = "won"
                  salesLink.lead.attributionFrozenAt = data.attributionFrozenAt as Date
                }
                return { count: 1 }
              },
            },
            salesTask: {
              updateMany: async () => {
                cancelledTaskCount += 1
                return { count: 1 }
              },
            },
            salesActivity: {
              create: async ({ data }: { data: Record<string, unknown> }) => {
                completedSalesActivity = data
                return { id: "sales-activity" }
              },
            },
            salesReferral: { updateMany: async () => ({ count: 1 }) },
          })
        } catch (error) {
          createdWorkshopData = snapshot.createdWorkshopData
          createdWorkshopCount = snapshot.createdWorkshopCount
          createdOwnerCount = snapshot.createdOwnerCount
          convertedLeadData = snapshot.convertedLeadData
          completedSalesActivity = snapshot.completedSalesActivity
          cancelledTaskCount = snapshot.cancelledTaskCount
          if (salesLink) {
            salesLink.usedAt = snapshot.linkUsedAt
            salesLink.workshopId = snapshot.linkWorkshopId
            if (!snapshot.linkWorkshopId) {
              salesLink.lead.workshopId = null
              salesLink.lead.status = "onboarding"
              salesLink.lead.attributionFrozenAt = null
            }
          }
          throw error
        }
      })
      transactionQueue = run.then(() => undefined, () => undefined)
      return run
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

function prepareSalesLink(token: string, overrides: Partial<NonNullable<typeof salesLink>> = {}) {
  salesLink = {
    tokenHash: hashSalesRegistrationToken(token),
    advisorId: "advisor-1",
    createdById: "advisor-user-1",
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
    revokedAt: null,
    workshopId: null,
    advisorDisabledAt: null,
    advisorUserActive: true,
    lead: {
      id: "lead-1",
      source: "field",
      status: "onboarding",
      advisorId: "advisor-1",
      workshopId: null,
      attributionFrozenAt: null,
    },
    ...overrides,
  }
}

beforeEach(() => {
  process.env.RATE_LIMIT_STORE = "memory"
  resetRateLimitStateForTests()
  createdWorkshopData = null
  transactionCount = 0
  referralCodes = new Map()
  transactionQueue = Promise.resolve()
  salesLink = null
  createdWorkshopCount = 0
  createdOwnerCount = 0
  convertedLeadData = null
  completedSalesActivity = null
  cancelledTaskCount = 0
  failLeadConversion = false
  existingUser = null
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

  test("rejects a raw advisor id from the public registration endpoint", async () => {
    const response = await POST(request({
      ...validBody,
      acquisitionSource: "sales_advisor",
      acquisitionAdvisorId: "advisor-forged",
    }, "198.51.100.74"))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: "Satış danışmanı atfı yalnız güvenli kayıt bağlantısıyla yapılabilir.",
    })
    expect(transactionCount).toBe(0)
    expect(createdWorkshopCount).toBe(0)
  })

  test("does not silently resume an existing pending account through a sales link", async () => {
    const token = "sales-token-existing-account"
    prepareSalesLink(token)
    existingUser = {
      password: "already-hashed-password",
      workshop: { id: "workshop-existing", approvalStatus: "pending", trialStartedAt: null },
    }

    const response = await POST(request({
      ...validBody,
      salesRegistrationToken: token,
    }, "198.51.100.82"))

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: "Bu e-posta adresi ile zaten bir hesap mevcut. Giriş yapmayı deneyin.",
    })
    expect(transactionCount).toBe(0)
    expect(createdWorkshopCount).toBe(0)
    expect(salesLink?.usedAt).toBeNull()
  })

  test.each([
    ["expired", { expiresAt: new Date(Date.now() - 1_000) }],
    ["revoked", { revokedAt: new Date() }],
    ["used", { usedAt: new Date() }],
  ] as const)("rejects a %s sales registration link", async (_state, override) => {
    const token = `sales-token-${_state}`
    prepareSalesLink(token, override)

    const response = await POST(request({
      ...validBody,
      salesRegistrationToken: token,
    }, `198.51.100.${_state === "expired" ? "75" : _state === "revoked" ? "76" : "77"}`))

    expect(response.status).toBe(410)
    expect(await response.json()).toEqual({ error: "Bu kayıt bağlantısı artık geçerli değil." })
    expect(createdWorkshopCount).toBe(0)
    expect(createdOwnerCount).toBe(0)
  })

  test("atomically creates owner/workshop and freezes lead attribution from a valid link", async () => {
    const token = "sales-token-valid"
    prepareSalesLink(token)

    const response = await POST(request({
      ...validBody,
      acquisitionSource: "website",
      salesRegistrationToken: token,
    }, "198.51.100.78"))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(createdWorkshopCount).toBe(1)
    expect(createdOwnerCount).toBe(1)
    expect(createdWorkshopData).toMatchObject({
      acquisitionSource: "sales_advisor",
      acquisitionAdvisorId: "advisor-1",
      referredByWorkshopId: null,
      referralCodeUsed: null,
    })
    expect(convertedLeadData).toMatchObject({
      workshopId: "workshop-new",
      status: "won",
      nextActionAt: null,
      lostReason: null,
    })
    expect(convertedLeadData?.attributionFrozenAt).toBeInstanceOf(Date)
    expect(completedSalesActivity).toMatchObject({
      leadId: "lead-1",
      result: "won",
      createdById: "advisor-user-1",
    })
    expect(cancelledTaskCount).toBe(1)
    expect(salesLink?.workshopId).toBe("workshop-new")
    expect(salesLink?.usedAt).toBeInstanceOf(Date)
  })

  test("allows only one workshop and owner across concurrent submissions", async () => {
    const token = "sales-token-concurrent"
    prepareSalesLink(token)

    const responses = await Promise.all([
      POST(request({ ...validBody, salesRegistrationToken: token }, "198.51.100.79")),
      POST(request({ ...validBody, salesRegistrationToken: token }, "198.51.100.80")),
    ])

    expect(responses.map((response) => response.status).sort()).toEqual([200, 410])
    expect(createdWorkshopCount).toBe(1)
    expect(createdOwnerCount).toBe(1)
    expect(salesLink?.workshopId).toBe("workshop-new")
  })

  test("rolls back link claim and workshop/owner when lead conversion loses the race", async () => {
    const token = "sales-token-rollback"
    prepareSalesLink(token)
    failLeadConversion = true

    const response = await POST(request({
      ...validBody,
      salesRegistrationToken: token,
    }, "198.51.100.81"))

    expect(response.status).toBe(410)
    expect(createdWorkshopCount).toBe(0)
    expect(createdOwnerCount).toBe(0)
    expect(convertedLeadData).toBeNull()
    expect(salesLink?.usedAt).toBeNull()
    expect(salesLink?.workshopId).toBeNull()
    expect(salesLink?.lead.status).toBe("onboarding")
    expect(salesLink?.lead.attributionFrozenAt).toBeNull()
  })
})
