import { prisma } from "@/lib/db"
import { getVinProvider } from "./provider"
import { VinLookupError, isValidVin, normalizeVin } from "./types"

const DEFAULT_MONTHLY_CAP = 18_000 // headroom under the 20k RapidAPI plan

function monthlyCap(): number {
  const raw = Number(process.env.VIN_LOOKUP_MONTHLY_CAP)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MONTHLY_CAP
}

export interface VinLookupResult {
  vin: string
  status: "found" | "not_found"
  raw: unknown
  cached: boolean
  provider: string
}

/**
 * Cache-first VIN decode. Each VIN hits the paid provider at most once ever
 * (found/not_found are terminal facts); transport errors are NOT cached so
 * they stay retryable. Monthly billed usage == vin_lookups rows created this
 * month, checked against VIN_LOOKUP_MONTHLY_CAP before any provider call.
 */
export async function lookupVin(input: string): Promise<VinLookupResult> {
  const vin = normalizeVin(input)
  if (!isValidVin(vin)) {
    throw new VinLookupError("invalid_vin", "Geçersiz şase numarası (VIN 17 karakter olmalı, I/O/Q harfleri içeremez).")
  }

  const cachedRow = await prisma.vinLookup.findUnique({ where: { vin } })
  if (cachedRow) {
    prisma.vinLookup
      .update({ where: { vin }, data: { hitCount: { increment: 1 } } })
      .catch(() => {}) // observability only — never block or fail the lookup
    return { vin, status: cachedRow.status, raw: cachedRow.rawResponse, cached: true, provider: cachedRow.provider }
  }

  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const usedThisMonth = await prisma.vinLookup.count({ where: { createdAt: { gte: monthStart } } })
  if (usedThisMonth >= monthlyCap()) {
    throw new VinLookupError("quota_exceeded", "Aylık VIN sorgu limiti doldu. Lütfen daha sonra tekrar deneyin.")
  }

  const provider = getVinProvider()
  const result = await provider.lookup(vin)

  const row = await prisma.vinLookup.upsert({
    where: { vin }, // upsert: concurrent first-lookups of the same VIN must not crash
    create: {
      vin,
      status: result.status,
      provider: provider.name,
      rawResponse: result.raw === null ? undefined : (result.raw as object),
    },
    update: { hitCount: { increment: 1 } },
  })

  return { vin, status: row.status, raw: row.rawResponse, cached: false, provider: provider.name }
}
