import type { OcrProvider, RegistrationOcrResult } from "./types"
import {
  RegistrationFieldsSchema,
  toRegistrationResult,
  type RegistrationFields,
} from "./registration-result"
import { extractRegistrationText } from "./tesseract-text-extractor"

type DeepSeekResponse = {
  error?: { message?: string }
  choices?: Array<{
    finish_reason?: string | null
    message?: {
      content?: string | null
      reasoning_content?: string | null
    }
  }>
}

const JSON_EXAMPLE = {
  plate: "35 CCZ 618",
  vin: "XP7YGCFRXRB449074",
  ownerName: "OKAN",
  ownerSurname: "TÜRKYILMAZ",
  brand: "TESLA",
  model: "MODEL Y",
  vehicleType: "OTOMOBİL (AF ÇOK AMAÇLI)",
  modelYear: "2024",
  engineNo: "GFB240990016CN",
  registrationDate: "22/06/2024",
}

const FIELD_INSTRUCTIONS =
  "Alanlar: plate, vin, ownerName, ownerSurname, brand, model, vehicleType, " +
  "modelYear, engineNo, registrationDate. D.1 MARKASI brand, D.3 TİCARİ ADI model, " +
  "D.5 CİNSİ vehicleType, D.4 MODEL YILI modelYear, P.5 MOTOR NO engineNo, E ŞASE NO vin, " +
  "C.1.2 ADI ownerName, C.1.1 SOYADI/TİCARİ ÜNVANI ownerSurname ve " +
  "I TESCİL TARİHİ registrationDate alanıdır."

function parseJsonContent(content: string) {
  const trimmed = content.trim()
  const json = trimmed.startsWith("```")
    ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
    : trimmed

  return RegistrationFieldsSchema.parse(JSON.parse(json))
}

function extractModelYear(rawText: string): string | null {
  const lines = rawText.split(/\r?\n/)
  const labelIndex = lines.findIndex((line) => /\bD[.,]?\s*4\b|MODEL\s+YILI/i.test(line))
  if (labelIndex === -1) return null

  const currentYear = new Date().getFullYear()
  const nearbyText = lines.slice(labelIndex, labelIndex + 10).join(" ")
  const years = nearbyText.match(/\b(?:19|20)\d{2}\b/g) || []

  return years.find((year) => {
    const numericYear = Number(year)
    return numericYear >= 1900 && numericYear <= currentYear + 1
  }) || null
}

function reconcileFields(
  fields: RegistrationFields,
  rawText: string
): RegistrationFields {
  const modelYear = extractModelYear(rawText)

  return {
    ...fields,
    modelYear: modelYear || fields.modelYear,
  }
}

export class DeepSeekOcrProvider implements OcrProvider {
  readonly name = "deepseek"

  constructor(
    private readonly apiKey: string,
    private readonly model = process.env.DEEPSEEK_OCR_MODEL || "deepseek-v4-flash"
  ) {}

  private async requestFields(rawText: string, compact = false) {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: "system",
            content: compact
              ? `Türk ruhsat OCR metnini JSON yap. ${FIELD_INSTRUCTIONS} ` +
                "Bulunmayan alan boş string. Yalnızca geçerli JSON döndür."
              : "Aşağıdaki OCR metni bir Türk araç tescil belgesinden alınmıştır. " +
                "Belgedeki alanları JSON olarak eşle. OCR karakter hatalarını yalnızca alan etiketi, " +
                "plaka, VIN ve tarih biçimi açıkça destekliyorsa düzelt; bilgi uydurma. " +
                `Bulunamayan her alan için boş string kullan. ${FIELD_INSTRUCTIONS} ` +
                `Yalnızca geçerli JSON döndür. JSON örneği: ${JSON.stringify(JSON_EXAMPLE)}`,
          },
          {
            role: "user",
            content: `Ruhsat OCR metnini JSON alanlarına dönüştür:\n\n${rawText}`,
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: compact ? 1800 : 2400,
        stream: false,
      }),
    })

    const data = (await response.json()) as DeepSeekResponse
    if (!response.ok) {
      throw new Error(data.error?.message || `DeepSeek HTTP ${response.status} hatası döndürdü`)
    }

    const choice = data.choices?.[0]
    const content = choice?.message?.content
    if (!content) {
      return null
    }

    try {
      return parseJsonContent(content)
    } catch (error) {
      console.error("[DEEPSEEK JSON ERROR]", {
        finishReason: choice?.finish_reason,
        contentLength: content.length,
        reasoningLength: choice?.message?.reasoning_content?.length || 0,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  async extractRegistration(imageBuffer: Buffer, _mimeType: string): Promise<RegistrationOcrResult> {
    const rawText = await extractRegistrationText(imageBuffer)
    const fields =
      (await this.requestFields(rawText)) ||
      (await this.requestFields(rawText, true))

    if (!fields) {
      throw new Error(
        "DeepSeek ruhsat alanlarını oluşturamadı. Lütfen fotoğrafı yeniden deneyin."
      )
    }

    return toRegistrationResult(reconcileFields(fields, rawText), rawText)
  }
}
