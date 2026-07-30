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

/** `withModel` prefixes the model name — needed when the candidates span several
 *  models (a VIN that matches Saloon/Hatchback/Estate at once), otherwise the
 *  picker would show the same "1.6 Multijet" row three times. */
function buildLabel(row: CandidateTypeRow, withModel = false): string {
  const parts = [withModel ? `${row.modelName} ${row.name}`.trim() : row.name]
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
export function scoreCandidates(rows: CandidateTypeRow[], hints: RuhsatHints, withModel = false): VinCandidate[] {
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
        const hint = hintFuel.toLowerCase()
        // Exact fuel ("Diesel") scores full; a mixed listing ("Diesel/Electro"
        // mHEV) that merely contains the hint scores less, so pure-fuel variants
        // rank above the mild-hybrids the ruhsat's "DİZEL" can't distinguish.
        if (rowFuel === hint) score += 2
        else if (rowFuel.includes(hint)) score += 1
      }
      if (hintYear != null && yearInRange(hintYear, row.yearFrom, row.yearTo)) {
        score += 2
      }
      return {
        vehicleTypeId: row.id,
        modelId: row.modelId,
        brandId: row.brandId,
        brandName: row.brandName,
        modelName: row.modelName,
        label: buildLabel(row, withModel),
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

/**
 * Narrow the scored candidates to those satisfying every ruhsat hint that is
 * present: cc/kW within tolerance and fuel-compatible (a "Diesel/Electro" mHEV
 * still contains "diesel", so it survives a DİZEL hint). Absent hints don't
 * filter. Falls back to the full list when no hint applies or nothing survives,
 * so an over-strict filter or a slightly-off reading never empties the picker.
 */
export function filterByHints(candidates: VinCandidate[], hints: RuhsatHints): VinCandidate[] {
  const hintCc = parseCc(hints.engineDisplacement)
  const hintKw = parseKw(hints.enginePower)
  const hintFuel = mapRuhsatFuel(hints.fuelType)
  if (hintCc == null && hintKw == null && hintFuel == null) return candidates

  const strong = candidates.filter((c) => {
    if (hintCc != null && c.cc != null && Math.abs(c.cc - hintCc) > CC_TOLERANCE) return false
    if (hintKw != null && c.kwt != null && Math.abs(c.kwt - hintKw) > KW_TOLERANCE) return false
    if (hintFuel != null && c.fuelType != null && !c.fuelType.toLowerCase().includes(hintFuel.toLowerCase())) return false
    return true
  })
  return strong.length > 0 ? strong : candidates
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

/** Local snapshot row (VehicleType joined w/ model+brand) → scoring input. */
type LocalTypeRow = {
  id: number
  name: string
  cc: number | null
  fuelType: string | null
  hp: number | null
  kwt: number | null
  yearFrom: string | null
  yearTo: string | null
  model: { id: number; name: string; brand: { id: number; name: string } }
}

function localTypeToRow(t: LocalTypeRow): CandidateTypeRow {
  return {
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
  }
}

/**
 * Model-level-only VIN match: TecDoc recognizes the model but serves no
 * vehicle-level row for this VIN (common for TR-market VINs — e.g. FIAT TIPO
 * returns three models and `matchingVehicles: []`). Without this fallback the
 * vehicle is saved brand/model-only, `catalogVehicleTypeId` stays null and the
 * parts catalog is unreachable for it forever — there is no manual engine-variant
 * picker anywhere in the app.
 *
 * The local snapshot carries every engine variant of those models and its ids
 * ARE TecDoc ids, so the variants are legitimate link targets. They go through
 * the same scoring/filtering as provider matches; the body type (Saloon vs.
 * Hatchback vs. Estate) is NOT derivable from the VIN, so whenever candidates
 * span several models the user always picks — never auto-select.
 */
export function resolveModelLevelCandidates(
  rows: CandidateTypeRow[],
  hints: RuhsatHints
): { candidates: VinCandidate[]; status: "resolved" | "ambiguous"; autoSelected: number | null } {
  const multiModel = new Set(rows.map((r) => r.modelId)).size > 1
  const scored = scoreCandidates(rows, hints, multiModel)
  const candidates = filterByHints(scored, hints).slice(0, MAX_CANDIDATES)
  const spansModels = new Set(candidates.map((c) => c.modelId)).size > 1
  const decided = spansModels ? { status: "ambiguous" as const, autoSelected: null } : decideResolution(candidates)
  return { candidates, ...decided }
}

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

  const providerVehicles = sections.matchingVehicles
  if (providerVehicles.length === 0) {
    // No vehicle-level match — offer the matched models' engine variants from
    // the local snapshot so the vehicle is still linkable (see
    // resolveModelLevelCandidates).
    const matchedModelIds = [...new Set(sections.matchingModels.map((m) => m.modelId))]
    const modelVariants = matchedModelIds.length
      ? await prisma.vehicleType.findMany({
          where: { modelId: { in: matchedModelIds } },
          include: { model: { include: { brand: true } } },
        })
      : []
    if (modelVariants.length > 0) {
      const { candidates, status, autoSelected } = resolveModelLevelCandidates(
        modelVariants.map(localTypeToRow),
        hints
      )
      // Brand/model text: the auto-selected variant when there is one. Otherwise
      // fill only what every candidate agrees on — the brand always does, the
      // model only when a single body type survived.
      const anchor = candidates.find((c) => c.vehicleTypeId === autoSelected) ?? candidates[0]
      const oneBrand = new Set(candidates.map((c) => c.brandId)).size === 1
      const oneModel = new Set(candidates.map((c) => c.modelId)).size === 1
      return {
        status,
        brand: autoSelected != null || oneBrand ? { id: anchor.brandId, name: anchor.brandName } : null,
        model: autoSelected != null || oneModel ? { id: anchor.modelId, name: anchor.modelName } : null,
        autoSelected,
        candidates,
        cached: lookup.cached,
      }
    }

    // The local snapshot carries no variant for these models — fall back to
    // model/brand so the form can still fill in the text (no vehicleTypeId →
    // parts stay unlinkable).
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

  // The provider's vehicleId IS the catalog key — categories/articles are served
  // by that same id (see /api/tecdoc/*). The local snapshot (a different TecDoc
  // dataset) may not carry the exact vehicle-type id, so it can only *enrich*
  // (cc/kW/fuel/year for scoring, canonical names) — never gate — the match.
  const vehicleIds = [...new Set(providerVehicles.map((v) => v.vehicleId))]
  const modelIds = [...new Set(providerVehicles.map((v) => v.modelId))]
  const [localTypes, localModels] = await Promise.all([
    prisma.vehicleType.findMany({
      where: { id: { in: vehicleIds } },
      include: { model: { include: { brand: true } } },
    }),
    prisma.vehicleModel.findMany({ where: { id: { in: modelIds } }, include: { brand: true } }),
  ])
  const localTypeById = new Map(localTypes.map((t) => [t.id, t]))
  const localModelById = new Map(localModels.map((m) => [m.id, m]))
  const providerModelName = new Map(sections.matchingModels.map((m) => [m.modelId, m.modelName]))
  const providerManuName = new Map(sections.matchingManufacturers.map((m) => [m.manuId, m.manuName]))

  const rows: CandidateTypeRow[] = providerVehicles.map((v) => {
    const local = localTypeById.get(v.vehicleId)
    if (local) {
      return {
        id: local.id,
        name: local.name,
        cc: local.cc,
        fuelType: local.fuelType,
        hp: local.hp,
        kwt: local.kwt,
        yearFrom: local.yearFrom,
        yearTo: local.yearTo,
        modelId: local.model.id,
        modelName: local.model.name,
        brandId: local.model.brand.id,
        brandName: local.model.brand.name,
      }
    }
    // Provider-only vehicle: no local cc/kW to score on, but the carName carries
    // the variant and matchingModels/Manufacturers give canonical names.
    const model = localModelById.get(v.modelId)
    return {
      id: v.vehicleId,
      name: v.vehicleTypeDescription || v.carName || `Araç #${v.vehicleId}`,
      cc: null,
      fuelType: null,
      hp: null,
      kwt: null,
      yearFrom: null,
      yearTo: null,
      modelId: v.modelId,
      modelName: model?.name ?? providerModelName.get(v.modelId) ?? v.carName ?? "",
      brandId: v.manuId,
      brandName: model?.brand.name ?? providerManuName.get(v.manuId) ?? "",
    }
  })

  // Score every catalog variant, then hard-filter to those matching the ruhsat
  // hints so the picker shows genuine matches (not all 10 engine variants).
  const scored = scoreCandidates(rows, hints)
  const candidates = filterByHints(scored, hints).slice(0, MAX_CANDIDATES)
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
