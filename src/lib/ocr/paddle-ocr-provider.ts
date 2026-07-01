import type { OcrProvider, RegistrationOcrResult, OcrFieldConfidence } from "./types"
import { RegistrationFieldsSchema, toRegistrationResult } from "./registration-result"
import { z } from "zod"

/**
 * PaddleOCR tabanlı ruhsat OCR sağlayıcısı.
 *
 * OCR'ın kendisi Python'da çalışır (paddlepaddle + paddleocr) ve KASITLI olarak
 * ayrı bir sidecar servisidir (bkz. ocr-service/) — böylece Next.js Alpine imajı
 * ağır CV/ML bağımlılıklarıyla şişmez. Bu sınıf yalnızca görüntüyü sidecar'a
 * HTTP ile gönderip dönen yapılandırılmış alanları RegistrationOcrResult'a çevirir.
 *
 * Sidecar sözleşmesi (POST /ocr, multipart "image"):
 *   { fields: {15 alan}, confidence: {alan->0..1}, rawText: string, provider, boxCount }
 */

// Sidecar 15 alanı da her zaman döndürür (bulunamayan alan "" olur). Toleranslı doğrula.
const FIELDS_SCHEMA = RegistrationFieldsSchema.extend({
  plate: z.string().default(""),
  vin: z.string().default(""),
  ownerName: z.string().default(""),
  ownerSurname: z.string().default(""),
  brand: z.string().default(""),
  model: z.string().default(""),
  vehicleType: z.string().default(""),
  modelYear: z.string().default(""),
  engineNo: z.string().default(""),
  registrationDate: z.string().default(""),
})

const RESPONSE_SCHEMA = z.object({
  fields: FIELDS_SCHEMA,
  confidence: z.record(z.string(), z.number()).default({}),
  rawText: z.string().default(""),
})

// Güven skoru taşıyan alanlar (rawText hariç).
const CONFIDENCE_KEYS = [
  "plate",
  "vin",
  "ownerName",
  "ownerSurname",
  "brand",
  "model",
  "vehicleType",
  "modelYear",
  "engineNo",
  "registrationDate",
  "commercialName",
  "fuelType",
  "engineDisplacement",
  "enginePower",
  "inspectionValidUntil",
] as const

export class PaddleOcrProvider implements OcrProvider {
  readonly name = "paddle" as const

  constructor(
    private readonly serviceUrl: string,
    private readonly timeoutMs: number = 60_000
  ) {}

  async extractRegistration(imageBuffer: Buffer, mimeType: string): Promise<RegistrationOcrResult> {
    const form = new FormData()
    const blob = new Blob([new Uint8Array(imageBuffer)], { type: mimeType || "image/jpeg" })
    form.append("image", blob, "ruhsat.jpg")

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    let response: Response
    try {
      response = await fetch(new URL("/ocr", this.serviceUrl), {
        method: "POST",
        body: form,
        signal: controller.signal,
      })
    } catch (err) {
      const cause = err instanceof Error ? err.message : String(err)
      throw new Error(
        `PaddleOCR servisine ulaşılamadı (${this.serviceUrl}). Sidecar çalışıyor mu? ` +
          `(ocr-service: uvicorn main:app --port 8000). Ayrıntı: ${cause}`
      )
    } finally {
      clearTimeout(timer)
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "")
      throw new Error(`PaddleOCR servisi hata döndürdü (${response.status}). ${detail}`.trim())
    }

    const parsed = RESPONSE_SCHEMA.parse(await response.json())
    const base = toRegistrationResult(parsed.fields, parsed.rawText)

    // Sidecar'ın alan bazlı güven skorlarını taşı; skoru olmayan/boş alan 0 kalır.
    for (const key of CONFIDENCE_KEYS) {
      const cell = base[key] as OcrFieldConfidence
      cell.confidence = parsed.confidence[key] ?? 0
    }

    return { ...base, provider: "paddle" }
  }
}
