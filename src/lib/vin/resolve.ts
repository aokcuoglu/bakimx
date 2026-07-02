import { prisma } from "@/lib/db"
import { lookupVin } from "./lookup"
import { extractMatchSections, type RuhsatHints, type VinCandidate, type VinResolution } from "./types"

/** Slim VehicleType row (joined w/ model+brand) — pure-scoring input, no Prisma types. */
export interface CandidateTypeRow {
  id: number
  name: string
  cc: number | null
  fuelType: string | null
  hp: number | null
  kwt: number | null
  yearFrom: string | null
  yearTo: string | null
  modelId: number
  modelName: string
  brandId: number
  brandName: string
}

/** "84 kW" → 84, "116" → 116, "84,5" → 85. */
export function parseKw(enginePower: string | null | undefined): number | null {
  if (!enginePower) return null
  const m = enginePower.replace(",", ".").match(/(\d+(?:\.\d+)?)/)
  return m ? Math.round(Number(m[1])) : null
}

/** "1499" → 1499, "1.499 cm3" → 1499 (dot as thousands separator when followed by 3 digits). */
export function parseCc(engineDisplacement: string | null | undefined): number | null {
  if (!engineDisplacement) return null
  const cleaned = engineDisplacement.replace(/\.(?=\d{3}\b)/g, "").replace(",", ".")
  const m = cleaned.match(/(\d+(?:\.\d+)?)/)
  return m ? Math.round(Number(m[1])) : null
}

/** Ruhsat Turkish fuel labels → TecDoc English fuel_type values. */
export function mapRuhsatFuel(fuel: string | null | undefined): string | null {
  if (!fuel) return null
  const f = fuel.toLocaleUpperCase("tr-TR")
  if (f.includes("DİZEL") || f.includes("DIZEL") || f.includes("DIESEL") || f.includes("MOTORİN")) return "Diesel"
  if (f.includes("ELEKTR")) return "Electric"
  if (f.includes("HİBRİT") || f.includes("HIBRIT") || f.includes("HYBRID")) return "Hybrid"
  // BENZİN, BENZİN-LPG, LPG: TecDoc lists LPG variants under Petrol / "Petrol/LPG"
  if (f.includes("BENZ") || f.includes("LPG")) return "Petrol"
  return null
}

/** Production-year hint: prefer explicit model year, fall back to the year in "07.05.2025". */
export function parseRegYear(
  firstRegistrationDate: string | null | undefined,
  modelYear: number | null | undefined
): number | null {
  if (modelYear && modelYear >= 1950 && modelYear <= 2100) return modelYear
  const m = firstRegistrationDate?.match(/(19|20)\d{2}/)
  return m ? Number(m[0]) : null
}

/** Catalog year strings are "YYYY-MM" (yearTo null = still in production). */
export function yearInRange(year: number, from: string | null, to: string | null): boolean {
  const fromYear = from ? Number(from.slice(0, 4)) : null
  const toYear = to ? Number(to.slice(0, 4)) : null
  if (fromYear && year < fromYear) return false
  if (toYear && year > toYear) return false
  return fromYear != null || toYear != null
}

const CC_TOLERANCE = 50
const KW_TOLERANCE = 3
/** "resolved" needs at least two strong signals (e.g. cc + kW). */
const RESOLVE_MIN_SCORE = 6

function buildLabel(row: CandidateTypeRow): string {
  const parts = [row.name]
  const power = [row.kwt != null ? `${row.kwt} kW` : null, row.hp != null ? `${row.hp} HP` : null]
    .filter(Boolean)
    .join(" / ")
  if (power) parts.push(power)
  if (row.yearFrom || row.yearTo) parts.push(`${row.yearFrom ?? "…"}–${row.yearTo ?? "…"}`)
  return parts.join(" • ")
}

/**
 * Score each candidate engine variant against the ruhsat hints. Absent hints
 * neither help nor hurt; a hint present on both sides but out of tolerance
 * penalizes. Returns candidates sorted by score desc (id asc as tiebreak).
 */
export function scoreCandidates(rows: CandidateTypeRow[], hints: RuhsatHints): VinCandidate[] {
  const hintCc = parseCc(hints.engineDisplacement)
  const hintKw = parseKw(hints.enginePower)
  const hintFuel = mapRuhsatFuel(hints.fuelType)
  const hintYear = parseRegYear(hints.firstRegistrationDate, hints.modelYear)

  return rows
    .map((row) => {
      let score = 0
      if (hintCc != null && row.cc != null) {
        score += Math.abs(row.cc - hintCc) <= CC_TOLERANCE ? 3 : -2
      }
      if (hintKw != null && row.kwt != null) {
        score += Math.abs(row.kwt - hintKw) <= KW_TOLERANCE ? 3 : -2
      }
      if (hintFuel != null && row.fuelType != null) {
        const rowFuel = row.fuelType.toLowerCase()
        if (rowFuel.includes(hintFuel.toLowerCase())) score += 2
      }
      if (hintYear != null && yearInRange(hintYear, row.yearFrom, row.yearTo)) {
        score += 2
      }
      return {
        vehicleTypeId: row.id,
        modelId: row.modelId,
        brandId: row.brandId,
        label: buildLabel(row),
        name: row.name,
        cc: row.cc,
        kwt: row.kwt,
        hp: row.hp,
        fuelType: row.fuelType,
        yearFrom: row.yearFrom,
        yearTo: row.yearTo,
        score,
      }
    })
    .sort((a, b) => b.score - a.score || a.vehicleTypeId - b.vehicleTypeId)
}

/** Auto-select only on a single candidate or a confident, strict winner. */
export function decideResolution(candidates: VinCandidate[]): { status: "resolved" | "ambiguous"; autoSelected: number | null } {
  if (candidates.length === 1) return { status: "resolved", autoSelected: candidates[0].vehicleTypeId }
  const [top, second] = candidates
  if (top && top.score >= RESOLVE_MIN_SCORE && (!second || top.score > second.score)) {
    return { status: "resolved", autoSelected: top.vehicleTypeId }
  }
  return { status: "ambiguous", autoSelected: null }
}

const MAX_CANDIDATES = 10

/**
 * VIN → local catalog resolution. Cache-first lookup (see lookupVin), then the
 * provider's TecDoc ids are joined directly to the local catalog — local ids
 * ARE TecDoc ids (VehicleBrand.id == manuId, VehicleModel.id == modelId,
 * VehicleType.id == vehicleId) — and ruhsat hints pick the engine variant.
 */
export async function resolveVinToCatalog(vin: string, hints: RuhsatHints = {}): Promise<VinResolution> {
  const lookup = await lookupVin(vin)
  const notFound: VinResolution = {
    status: "not_found", brand: null, model: null, autoSelected: null, candidates: [], cached: lookup.cached,
  }
  if (lookup.status === "not_found") return notFound

  const sections = extractMatchSections(lookup.raw)
  if (!sections) return notFound

  const vehicleIds = [...new Set(sections.matchingVehicles.map((v) => v.vehicleId))]
  const typeRows = vehicleIds.length
    ? await prisma.vehicleType.findMany({
        where: { id: { in: vehicleIds } },
        include: { model: { include: { brand: true } } },
      })
    : []

  if (typeRows.length === 0) {
    // Catalog snapshot may lag TecDoc — fall back to model/brand-level match.
    const modelMatch = sections.matchingModels[0]
    if (modelMatch) {
      const model = await prisma.vehicleModel.findUnique({
        where: { id: modelMatch.modelId },
        include: { brand: true },
      })
      if (model) {
        return {
          status: "resolved",
          brand: { id: model.brand.id, name: model.brand.name },
          model: { id: model.id, name: model.name },
          autoSelected: null,
          candidates: [],
          cached: lookup.cached,
        }
      }
    }
    const manuMatch = sections.matchingManufacturers[0]
    if (manuMatch) {
      const brand = await prisma.vehicleBrand.findUnique({ where: { id: manuMatch.manuId } })
      if (brand) {
        return {
          status: "resolved",
          brand: { id: brand.id, name: brand.name },
          model: null,
          autoSelected: null,
          candidates: [],
          cached: lookup.cached,
        }
      }
    }
    return notFound
  }

  const rows: CandidateTypeRow[] = typeRows.map((t) => ({
    id: t.id,
    name: t.name,
    cc: t.cc,
    fuelType: t.fuelType,
    hp: t.hp,
    kwt: t.kwt,
    yearFrom: t.yearFrom,
    yearTo: t.yearTo,
    modelId: t.model.id,
    modelName: t.model.name,
    brandId: t.model.brand.id,
    brandName: t.model.brand.name,
  }))

  const candidates = scoreCandidates(rows, hints).slice(0, MAX_CANDIDATES)
  const { status, autoSelected } = decideResolution(candidates)

  // Brand/model are safe to fill even when the engine variant is ambiguous,
  // as long as every candidate agrees on the model.
  const uniqueModelIds = new Set(candidates.map((c) => c.modelId))
  const anchor = autoSelected != null
    ? rows.find((r) => r.id === autoSelected)!
    : uniqueModelIds.size === 1
      ? rows.find((r) => r.id === candidates[0].vehicleTypeId)!
      : null

  return {
    status,
    brand: anchor ? { id: anchor.brandId, name: anchor.brandName } : null,
    model: anchor ? { id: anchor.modelId, name: anchor.modelName } : null,
    autoSelected,
    candidates,
    cached: lookup.cached,
  }
}
