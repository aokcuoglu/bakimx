import { createHmac, randomInt } from "node:crypto"
import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"

const DAY = 86_400_000
export const DEMO_BROWSER_SECONDS = 400 * DAY / 1000
export class DemoQuotaError extends Error {
  constructor(public code: "used" | "limited", public retryAfterSeconds: number) {
    super(code)
  }
}
export type DemoReservation = { browserKey: string; ipKey: string; stamp: Date; marker: number }
export function demoQuotaKeys(browser: string, ip: string, secret: string) {
  const hash = (value: string) => createHmac("sha256", secret).update(`demo-ocr:${value}`).digest("hex")
  return { browserKey: `demo-ocr:browser:${hash(browser)}`, ipKey: `demo-ocr:ip:${hash(ip)}`, attemptKey: `demo-ocr:attempt:${hash(ip)}`, globalKey: "demo-ocr:global" }
}
type Keys = ReturnType<typeof demoQuotaKeys>
async function locked<T>(fn: (tx: Prisma.TransactionClient, now: Date) => Promise<T>, database = prisma): Promise<T> {
  // One short cross-task lock orders all quota checks/writes. No network call under lock.
  return database.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(602, 1)`
    const [clock] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`
    return fn(tx, clock.now)
  }, { timeout: 5000, maxWait: 5000 })
}
async function check(tx: Prisma.TransactionClient, keys: Keys, now: Date, maxGlobal: number) {
  const rows = await tx.rateLimitCounter.findMany({ where: { key: { in: Object.values(keys) }, resetAt: { gt: now } } })
  for (const [key, max, code] of [[keys.browserKey, 1, "used"], [keys.ipKey, 1, "limited"], [keys.attemptKey, 3, "limited"], [keys.globalKey, maxGlobal, "limited"]] as const) {
    const row = rows.find(row => row.key === key)
    if (row && row.count >= max) throw new DemoQuotaError(code, Math.ceil((row.resetAt.getTime() - now.getTime()) / 1000))
  }
  return rows
}
export async function demoQuotaStatus(keys: Keys, maxGlobal: number, database = prisma) {
  await locked((tx, now) => check(tx, keys, now, maxGlobal), database)
}
export async function reserveDemoQuota(keys: Keys, maxGlobal: number, database = prisma): Promise<DemoReservation> {
  return locked(async (tx, now) => {
    const rows = await check(tx, keys, now, maxGlobal)
    const marker = randomInt(1, 2_147_483_647)
    for (const key of Object.values(keys)) {
      const previous = rows.find(row => row.key === key)
      const resetAt = previous?.resetAt ?? new Date(now.getTime() + (key === keys.browserKey ? DEMO_BROWSER_SECONDS * 1000 : DAY))
      const count = key === keys.browserKey ? marker : (previous?.count ?? 0) + 1
      await tx.rateLimitCounter.upsert({ where: { key }, create: { key, count, resetAt }, update: { count, resetAt } })
    }
    return { browserKey: keys.browserKey, ipKey: keys.ipKey, stamp: new Date(now.getTime() + DEMO_BROWSER_SECONDS * 1000), marker }
  }, database)
}
export async function refundDemoQuota(reservation: DemoReservation, database = prisma) {
  await locked(async tx => {
    // Generation check prevents a late result from releasing a newer reservation.
    const owner = await tx.rateLimitCounter.findUnique({ where: { key: reservation.browserKey } })
    if (owner?.resetAt.getTime() !== reservation.stamp.getTime() || owner.count !== reservation.marker) return
    await tx.rateLimitCounter.deleteMany({ where: { key: { in: [reservation.browserKey, reservation.ipKey] } } })
  }, database)
}
