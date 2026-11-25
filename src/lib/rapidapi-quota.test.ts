import { expect, test } from "bun:test"
import {
  WorkshopQuotaExceededError,
  quotaMonthWindow,
  reserveWorkshopQuota,
  getWorkshopQuotaContext,
  summarizeWorkshopQuotaUsage,
  type QuotaReservationClient,
  type QuotaReservationDatabase,
  type WorkshopQuotaContext,
} from "@/lib/rapidapi-quota"
import { ADDON_LOCKED_MESSAGE } from "@/lib/plan"

type UsageRow = { workshopId: string; source: string; createdAt: Date }

class FakeQuotaDatabase implements QuotaReservationDatabase {
  readonly rows: UsageRow[] = []
  lockCalls = 0
  private tail: Promise<void> = Promise.resolve()

  constructor(private readonly now: Date) {}

  async $transaction<T>(operation: (tx: QuotaReservationClient) => Promise<T>): Promise<T> {
    let release!: () => void
    const previous = this.tail
    this.tail = new Promise<void>((resolve) => {
      release = resolve
    })
    await previous
    try {
      const tx: QuotaReservationClient = {
        $executeRaw: async () => {
          this.lockCalls += 1
          return 1
        },
        quotaUsage: {
          count: async ({ where }) => {
            const createdAt = where?.createdAt as { gte?: Date; lt?: Date } | undefined
            return this.rows.filter(
              (row) =>
                row.workshopId === where?.workshopId &&
                (!createdAt?.gte || row.createdAt >= createdAt.gte) &&
                (!createdAt?.lt || row.createdAt < createdAt.lt),
            ).length
          },
          create: async ({ data }) => {
            this.rows.push({
              workshopId: data.workshopId,
              source: data.source,
              createdAt: this.now,
            })
            return {}
          },
        },
      }
      return await operation(tx)
    } finally {
      release()
    }
  }
}

const NOW = new Date("2026-09-07T12:00:00.000Z")

test("VIN ve TecDoc rezervasyonları doğru kaynak kırılımıyla yazılır", async () => {
  const db = new FakeQuotaDatabase(NOW)
  const context: WorkshopQuotaContext = { workshopId: "w1", baseQuota: 0, extraVinQuota: 2 }

  await reserveWorkshopQuota(context, "vin", db, NOW)
  await reserveWorkshopQuota(context, "tecdoc", db, NOW)

  expect(db.rows.map((row) => row.source)).toEqual(["vin", "tecdoc"])
  expect(db.lockCalls).toBe(2)
})

test("eşzamanlı rezervasyonlar tenant aylık limitini aşamaz", async () => {
  const db = new FakeQuotaDatabase(NOW)
  const context: WorkshopQuotaContext = { workshopId: "w1", baseQuota: 0, extraVinQuota: 2 }

  const results = await Promise.allSettled([
    reserveWorkshopQuota(context, "tecdoc", db, NOW),
    reserveWorkshopQuota(context, "tecdoc", db, NOW),
    reserveWorkshopQuota(context, "vin", db, NOW),
  ])

  expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2)
  const rejected = results.find((result) => result.status === "rejected")
  expect(rejected?.status === "rejected" ? rejected.reason : null).toBeInstanceOf(WorkshopQuotaExceededError)
  expect(db.rows).toHaveLength(2)
})

test("Lite ek kotasız rezervasyonu mevcut quota_exceeded sözleşmesini korur", async () => {
  const db = new FakeQuotaDatabase(NOW)
  const context: WorkshopQuotaContext = { workshopId: "w-lite", baseQuota: 0, extraVinQuota: 0 }
  await expect(reserveWorkshopQuota(context, "vin", db, NOW)).rejects.toMatchObject({ code: "quota_exceeded" })
  expect(db.rows).toHaveLength(0)
})

test("Servis Paketi'nde şaseden parça kotası yok — ek özellik metniyle reddedilir (#782)", async () => {
  const db = new FakeQuotaDatabase(NOW)
  const context: WorkshopQuotaContext = { workshopId: "w-pro", baseQuota: 0, extraVinQuota: 0 }
  await expect(reserveWorkshopQuota(context, "vin", db, NOW)).rejects.toMatchObject({ code: "quota_exceeded", cap: 0 })
  expect(db.rows).toHaveLength(0)
  expect(new WorkshopQuotaExceededError(0).message).toBe(ADDON_LOCKED_MESSAGE)
  expect(new WorkshopQuotaExceededError(100).message).toContain("Aylık katalog sorgu limitiniz doldu")
})

test("pro + ek özellik rezervasyonu geçer (#827)", async () => {
  const db = new FakeQuotaDatabase(NOW)
  const context = getWorkshopQuotaContext({
    id: "w-addon",
    planTier: "pro",
    subscriptionStatus: "active",
    approvalStatus: "approved",
    trialEndsAt: null,
    currentPeriodEnd: new Date("2027-01-01T00:00:00.000Z"),
    extraVinQuota: 0,
    addons: ["vinLookup"],
  })
  expect(context.baseQuota).toBe(15_000)
  await expect(reserveWorkshopQuota(context, "vin", db, NOW)).resolves.toBeUndefined()
  expect(db.rows).toHaveLength(1)
})

test("kullanım özeti ay sınırını, ek kotayı ve VIN/TecDoc kırılımını taşır", () => {
  const usage = summarizeWorkshopQuotaUsage(
    { workshopId: "w1", baseQuota: 15_000, extraVinQuota: 250 },
    [
      { source: "vin", count: 125 },
      { source: "tecdoc", count: 375 },
    ],
    NOW,
  )
  expect(usage).toMatchObject({
    baseQuota: 15_000,
    extraQuota: 250,
    totalCap: 15_250,
    used: 500,
    remaining: 14_750,
    vinUsed: 125,
    tecdocUsed: 375,
  })
  expect(usage.monthStart).toEqual(new Date("2026-09-01T00:00:00.000Z"))
  expect(usage.renewsAt).toEqual(new Date("2026-10-01T00:00:00.000Z"))
  expect(quotaMonthWindow(new Date("2026-12-31T23:59:59.000Z")).renewsAt).toEqual(
    new Date("2027-01-01T00:00:00.000Z"),
  )
})
