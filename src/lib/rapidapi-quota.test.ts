import { expect, test } from "bun:test"
import {
  WorkshopQuotaExceededError,
  quotaMonthWindow,
  reserveWorkshopQuota,
  resolveWorkshopQuotaContext,
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
  lockKeys: unknown[] = []
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
        $executeRaw: async (query) => {
          this.lockKeys.push(query.values[0])
          this.lockCalls += 1
          return 1
        },
        quotaUsage: {
          count: async ({ where }) => {
            const createdAt = where?.createdAt as { gte?: Date; lt?: Date } | undefined
            return this.rows.filter(
              (row) =>
                (where?.workshopId as { in: string[] }).in.includes(row.workshopId) &&
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
  const context: WorkshopQuotaContext = { workshopId: "w1", baseQuota: 0, extraVinQuota: 2, scopeWorkshopIds: ["w1"], lockScope: "w1" }

  await reserveWorkshopQuota(context, "vin", db, NOW)
  await reserveWorkshopQuota(context, "tecdoc", db, NOW)

  expect(db.rows.map((row) => row.source)).toEqual(["vin", "tecdoc"])
  expect(db.lockCalls).toBe(2)
})

test("eşzamanlı rezervasyonlar tenant aylık limitini aşamaz", async () => {
  const db = new FakeQuotaDatabase(NOW)
  const context: WorkshopQuotaContext = { workshopId: "w1", baseQuota: 0, extraVinQuota: 2, scopeWorkshopIds: ["w1"], lockScope: "w1" }

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
  const context: WorkshopQuotaContext = { workshopId: "w-lite", baseQuota: 0, extraVinQuota: 0, scopeWorkshopIds: ["w-lite"], lockScope: "w-lite" }
  await expect(reserveWorkshopQuota(context, "vin", db, NOW)).rejects.toMatchObject({ code: "quota_exceeded" })
  expect(db.rows).toHaveLength(0)
})

test("Servis Paketi'nde şaseden parça kotası yok — ek özellik metniyle reddedilir (#782)", async () => {
  const db = new FakeQuotaDatabase(NOW)
  const context: WorkshopQuotaContext = { workshopId: "w-pro", baseQuota: 0, extraVinQuota: 0, scopeWorkshopIds: ["w-pro"], lockScope: "w-pro" }
  await expect(reserveWorkshopQuota(context, "vin", db, NOW)).rejects.toMatchObject({ code: "quota_exceeded", cap: 0 })
  expect(db.rows).toHaveLength(0)
  expect(new WorkshopQuotaExceededError(0).message).toBe(ADDON_LOCKED_MESSAGE)
  expect(new WorkshopQuotaExceededError(100).message).toContain("Aylık katalog sorgu limitiniz doldu")
})

test("pro + ek özellik rezervasyonu geçer (#827)", async () => {
  const db = new FakeQuotaDatabase(NOW)
  const context = await resolveWorkshopQuotaContext({
    id: "w-addon",
    organizationId: null,
    planTier: "pro",
    subscriptionStatus: "active",
    approvalStatus: "approved",
    trialEndsAt: null,
    currentPeriodEnd: new Date("2027-01-01T00:00:00.000Z"),
    extraVinQuota: 0,
    addons: ["vinLookup"],
  })
  expect(context.baseQuota).toBe(1_000)
  expect(context.scopeWorkshopIds).toEqual(["w-addon"])
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

const orgWorkshop = (id: string, extraVinQuota: number) => ({
  id,
  organizationId: "org1",
  planTier: "pro" as const,
  subscriptionStatus: "active" as const,
  approvalStatus: "approved" as const,
  trialEndsAt: null,
  currentPeriodEnd: new Date("2027-01-01T00:00:00.000Z"),
  extraVinQuota,
  addons: ["vinLookup"],
})

test("organizasyonlu şubeler tek kotayı paylaşır; ek kota toplanır, kilit organizasyon başına (#829)", async () => {
  const members = [orgWorkshop("b1", 1), orgWorkshop("b2", 1)]
  let query: unknown
  const scopeDb = {
    workshop: {
      findMany: async (args: unknown) => {
        query = args
        return members
      },
    },
  }
  const c1 = await resolveWorkshopQuotaContext(orgWorkshop("b1", 1), scopeDb)
  const c2 = await resolveWorkshopQuotaContext(orgWorkshop("b2", 1), scopeDb)
  expect(query).toMatchObject({ where: { organizationId: "org1", kind: "customer" } })
  expect(c1.extraVinQuota).toBe(2)
  expect(c1.scopeWorkshopIds.sort()).toEqual(["b1", "b2"])
  expect(c1.lockScope).toBe("org1")

  // taban kotayı sıfırlayıp toplam cap = 2 ile paylaşımı doğrula
  const shared1 = { ...c1, baseQuota: 0 }
  const shared2 = { ...c2, baseQuota: 0 }
  const db = new FakeQuotaDatabase(NOW)
  await reserveWorkshopQuota(shared1, "vin", db, NOW)
  await reserveWorkshopQuota(shared2, "vin", db, NOW)
  await expect(reserveWorkshopQuota(shared1, "vin", db, NOW)).rejects.toMatchObject({ code: "quota_exceeded", cap: 2 })
  await expect(reserveWorkshopQuota(shared2, "tecdoc", db, NOW)).rejects.toMatchObject({ code: "quota_exceeded" })
  expect(db.rows.map((row) => row.workshopId)).toEqual(["b1", "b2"])
  expect(new Set(db.lockKeys).size).toBe(1)
  expect(String(db.lockKeys[0])).toContain("workshop-quota:org1:")
})

test("organizasyonsuz atölyede ek sorgu atılmaz (#829)", async () => {
  const scopeDb = { workshop: { findMany: async () => { throw new Error("sorgu atılmamalı") } } }
  const context = await resolveWorkshopQuotaContext({ ...orgWorkshop("solo", 3), organizationId: null }, scopeDb)
  expect(context).toMatchObject({ scopeWorkshopIds: ["solo"], lockScope: "solo", extraVinQuota: 3, baseQuota: 1_000 })
})

const FUTURE = new Date("2099-01-01T00:00:00.000Z")
const trialBranch = (id: string) => ({
  ...orgWorkshop(id, 0),
  planTier: "pro" as const,
  subscriptionStatus: "trialing" as const,
  trialEndsAt: FUTURE,
  currentPeriodEnd: null,
  addons: [] as string[],
})
const plainBranch = (id: string) => ({ ...orgWorkshop(id, 0), addons: [] as string[] })

test("karma şubelerde taban kota en yükseğidir; iki çağıran da aynı tavanı görür (#829)", async () => {
  const members = [trialBranch("t"), orgWorkshop("p", 0)]
  const scopeDb = { workshop: { findMany: async () => members } }
  const fromTrial = await resolveWorkshopQuotaContext(members[0], scopeDb)
  const fromPaid = await resolveWorkshopQuotaContext(members[1], scopeDb)
  expect(fromTrial.baseQuota).toBe(15_000)
  expect(fromPaid.baseQuota).toBe(15_000)
  expect(fromTrial.workshopCount).toBe(2)
})

test("ek özelliği olmayan şube, hesabın diğer şubesindeki hakkı alır (#829)", async () => {
  const members = [plainBranch("a"), orgWorkshop("b", 0)]
  const scopeDb = { workshop: { findMany: async () => members } }
  const ctx = await resolveWorkshopQuotaContext(members[0], scopeDb)
  expect(ctx.baseQuota).toBe(1_000)
})

test("müşteri olmayan çağıran da taban kotaya katılır; tek atölyede workshopCount 1", async () => {
  const caller = orgWorkshop("hq", 0)
  const ctx = await resolveWorkshopQuotaContext(caller, { workshop: { findMany: async () => [plainBranch("a")] } })
  expect(ctx.baseQuota).toBe(1_000)
  expect(ctx.workshopCount).toBe(2)
  const solo = await resolveWorkshopQuotaContext({ ...caller, organizationId: null })
  expect(solo.workshopCount).toBe(1)
})
