import { z } from "zod"
import type { PartBoxOcrResult, PartNumberSuggestion, OcrProviderName } from "./types"

export const PartNumberSuggestionSchema = z.object({
  value: z.string().default(""),
  label: z.string().default(""),
  confidence: z.number().min(0).max(1).optional(),
})

export const PartBoxFieldsSchema = z.object({
  partName: z.string().default(""),
  brand: z.string().default(""),
  partNumbers: z.array(PartNumberSuggestionSchema).default([]),
  // Modelin emin olmadığı alan adları ("partName" / "brand") — düşük güven uyarısı için.
  uncertainFields: z.array(z.string()).default([]),
})

export type PartBoxFields = z.infer<typeof PartBoxFieldsSchema>

// Parça numaralarını normalize et: trim + uppercase value, boşları at, value bazında tekilleştir.
export function normalizePartNumbers(
  items: { value: string; label: string; confidence?: number }[]
): PartNumberSuggestion[] {
  const seen = new Set<string>()
  const out: PartNumberSuggestion[] = []
  for (const it of items) {
    const value = it.value.trim().toUpperCase()
    if (!value || seen.has(value)) continue
    seen.add(value)
    out.push({ value, label: it.label.trim(), confidence: it.confidence })
  }
  return out
}

// "Yağ filtresi" + "SETA" → "Yağ filtresi — SETA". Marka boşsa/ad içinde geçiyorsa adı aynen bırakır.
export function partNameWithBrand(name: string, brand: string): string {
  const n = name.trim()
  const b = brand.trim()
  if (!b) return n
  if (!n) return b
  if (n.toLocaleLowerCase("tr").includes(b.toLocaleLowerCase("tr"))) return n
  return `${n} — ${b}`
}

export function toPartBoxResult(fields: PartBoxFields, provider: OcrProviderName): PartBoxOcrResult {
  const uncertain = new Set(fields.uncertainFields)
  return {
    partName: { value: fields.partName.trim(), confidence: uncertain.has("partName") ? 0.5 : 0.9 },
    brand: { value: fields.brand.trim(), confidence: uncertain.has("brand") ? 0.5 : 0.9 },
    partNumbers: normalizePartNumbers(fields.partNumbers),
    rawText: "",
    provider,
  }
}
