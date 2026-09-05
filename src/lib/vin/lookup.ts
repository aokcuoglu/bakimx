import { prisma } from "@/lib/db"
import { countRapidApiCallsThisMonth, rapidApiMonthlyCap, recordQuotaUsage } from "@/lib/rapidapi-quota"
import { getVinProvider } from "./provider"
import { VinLookupError, isValidVin, normalizeVin, vinModelKey } from "./types"

export interface VinLookupResult {
  vin: string
  status: "found" | "not_found"
  raw: unknown
  cached: boolean
  provider: string
}

/**
 * Cache-first VIN decode, deduped by model-prefix (WMI+VDS): the FIRST VIN of a
 * given model hits the paid provider once; later VINs sharing that prefix reuse
 * the cached decode and hit the provider ZERO times (found/not_found are
 * terminal facts). Transport errors are NOT cached so they stay retryable.
 * Monthly billed usage == vin_lookups rows created this month, checked against
 * VIN_LOOKUP_MONTHLY_CAP before any provider call.
 */
export async function lookupVin(input: string, workshopId?: string): Promise<VinLookupResult> {
  const vin = normalizeVin(input)
  if (!isValidVin(vin)) {
    throw new VinLookupError("invalid_vin", "Geçersiz şase numarası (17 karakter olmalı, I/O/Q harfleri içeremez).")
  }

  const provider = getVinProvider()

  // Mock responses are free and deterministic — never read or persist them, and
  // don't count them against the quota. A cached mock not_found would otherwise
  // shadow real data for the same VIN after switching to rapidapi (mirrors the
  // mock guard in TecDoc's cachedFetch).
  if (provider.name === "mock") {
    const result = await provider.lookup(vin)
    return { vin, status: result.status, raw: result.raw, cached: false, provider: provider.name }
  }

  // Cache dedupe anahtarı = model-önek (WMI+VDS). Aynı modelin farklı VIN'leri
  // aynı tecdoc-vin-check yanıtını hak eder; böylece her yeni VIN kota harcamaz.
  // Motor-varyant seçimi resolveVinToCatalog içinde her VIN için yerelde yapılır.
  const modelKey = vinModelKey(vin)
  const cachedRow = await prisma.vinLookup.findFirst({
    where: { modelKey },
    orderBy: { createdAt: "asc" },
  })
  if (cachedRow) {
    prisma.vinLookup
      .update({ where: { vin: cachedRow.vin }, data: { hitCount: { increment: 1 } } })
      .catch(() => {}) // observability only — never block or fail the lookup
    return { vin, status: cachedRow.status, raw: cachedRow.rawResponse, cached: true, provider: cachedRow.provider }
  }

  // Shared cap across the whole RapidAPI subscription (VIN + TecDoc catalog).
  if ((await countRapidApiCallsThisMonth()) >= rapidApiMonthlyCap()) {
    throw new VinLookupError("quota_exceeded", "Aylık şase sorgu limiti doldu. Lütfen daha sonra tekrar deneyin.")
  }

  const result = await provider.lookup(vin)

  const row = await prisma.vinLookup.upsert({
    where: { vin }, // upsert: concurrent first-lookups of the same VIN must not crash
    create: {
      vin,
      modelKey,
      status: result.status,
      provider: provider.name,
      rawResponse: result.raw === null ? undefined : (result.raw as object),
    },
    update: { hitCount: { increment: 1 } },
  })

  // Record per-workshop quota usage (fire-and-forget — never block the lookup)
  if (workshopId) {
    recordQuotaUsage(workshopId, "vin").catch(() => {})
  }

  return { vin, status: row.status, raw: row.rawResponse, cached: false, provider: provider.name }
}
