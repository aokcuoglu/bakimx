import { prisma } from "@/lib/db"

const DEFAULT_MONTHLY_CAP = 18_000 // headroom under the 20k RapidAPI plan

/** Single cap for the whole RapidAPI subscription — VIN lookups and TecDoc
 *  catalog calls bill the same 20k/month plan, so their caps must not add up
 *  independently. */
export function rapidApiMonthlyCap(): number {
  const raw = Number(process.env.RAPIDAPI_MONTHLY_CAP ?? process.env.VIN_LOOKUP_MONTHLY_CAP)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MONTHLY_CAP
}

/** Billed RapidAPI calls this month == cache rows created this month across
 *  both cache tables (errors are never cached, hits never create rows). */
export async function countRapidApiCallsThisMonth(): Promise<number> {
  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const [vin, tecdoc] = await Promise.all([
    prisma.vinLookup.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.tecdocCache.count({ where: { createdAt: { gte: monthStart } } }),
  ])
  return vin + tecdoc
}
