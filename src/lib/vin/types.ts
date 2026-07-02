import { z } from "zod"

/**
 * VIN normalization + validation. 17 chars, no I/O/Q (ISO 3779) — same rule as
 * the OCR extractor (ocr-service/extractor.py _clean_vin).
 */
export function normalizeVin(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "")
}

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/

export function isValidVin(input: string | null | undefined): boolean {
  if (!input) return false
  return VIN_RE.test(normalizeVin(input))
}

export type VinErrorCode = "invalid_vin" | "quota_exceeded" | "provider_error" | "config_error"

export class VinLookupError extends Error {
  readonly code: VinErrorCode
  constructor(code: VinErrorCode, message: string) {
    super(message)
    this.name = "VinLookupError"
    this.code = code
  }
}

/**
 * RapidAPI auto-parts-catalog tecdoc-vin-check payload. The provider wraps
 * every list in `{ "array": [...] }`; tolerate both that wrapper and a plain
 * array so a provider-side format change degrades gracefully.
 */
const wrappedArray = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((v) => {
    if (Array.isArray(v)) return v
    if (v && typeof v === "object" && Array.isArray((v as { array?: unknown }).array)) {
      return (v as { array: unknown[] }).array
    }
    return []
  }, z.array(item))

const manufacturerSchema = z.object({ manuId: z.number(), manuName: z.string() })
const modelSchema = z.object({ manuId: z.number(), modelId: z.number(), modelName: z.string() })
const vehicleSchema = z.object({
  manuId: z.number(),
  modelId: z.number(),
  vehicleId: z.number(),
  carName: z.string().optional(),
  vehicleTypeDescription: z.string().optional(),
  linkageTargetType: z.string().optional(),
  subLinkageTargetType: z.string().optional(),
})

export const vinMatchSectionsSchema = z.object({
  matchingManufacturers: wrappedArray(manufacturerSchema).default([]),
  matchingModels: wrappedArray(modelSchema).default([]),
  matchingVehicles: wrappedArray(vehicleSchema).default([]),
})

export type VinMatchSections = z.infer<typeof vinMatchSectionsSchema>

/**
 * The three matching* sections may sit at the payload root or nested one or two
 * levels deep (the provider wraps responses in envelope objects). Shallow-walk
 * until a level that carries at least one of the keys is found.
 */
export function extractMatchSections(raw: unknown, depth = 0): VinMatchSections | null {
  if (!raw || typeof raw !== "object" || depth > 3) return null
  const obj = raw as Record<string, unknown>
  if ("matchingManufacturers" in obj || "matchingModels" in obj || "matchingVehicles" in obj) {
    const parsed = vinMatchSectionsSchema.safeParse(obj)
    return parsed.success ? parsed.data : null
  }
  for (const value of Object.values(obj)) {
    const found = extractMatchSections(value, depth + 1)
    if (found) return found
  }
  return null
}

/** Ruhsat-derived hints used to pick the exact engine variant. Raw strings as OCR/form hold them. */
export interface RuhsatHints {
  /** Silindir hacmi, e.g. "1499" */
  engineDisplacement?: string | null
  /** Motor gücü, e.g. "84 kW" */
  enginePower?: string | null
  /** Yakıt cinsi, e.g. "DİZEL" */
  fuelType?: string | null
  /** İlk tescil tarihi, e.g. "07.05.2025" */
  firstRegistrationDate?: string | null
  modelYear?: number | null
}

export interface VinCandidate {
  vehicleTypeId: number
  modelId: number
  brandId: number
  /** Canonical catalog names — lets the client fill brand/model on candidate pick. */
  brandName: string
  modelName: string
  /** Server-built display label, e.g. "1.5 EcoBlue • 85 kW / 116 HP • 2024-05–…" */
  label: string
  name: string
  cc: number | null
  kwt: number | null
  hp: number | null
  fuelType: string | null
  yearFrom: string | null
  yearTo: string | null
  score: number
}

export interface VinResolution {
  status: "resolved" | "ambiguous" | "not_found"
  brand: { id: number; name: string } | null
  model: { id: number; name: string } | null
  /** vehicleTypeId auto-selected when status === "resolved". */
  autoSelected: number | null
  candidates: VinCandidate[]
  cached: boolean
}
