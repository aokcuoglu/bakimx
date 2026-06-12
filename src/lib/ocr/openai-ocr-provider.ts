import { z } from "zod"
import type { OcrProvider, RegistrationOcrResult } from "./types"
import { RegistrationFieldsSchema, toRegistrationResult } from "./registration-result"

const OpenAiRegistrationSchema = RegistrationFieldsSchema.extend({
  rawText: z.string(),
})

const JSON_SCHEMA = {
  type: "object",
  properties: {
    plate: { type: "string" },
    vin: { type: "string" },
    ownerName: { type: "string" },
    ownerSurname: { type: "string" },
    brand: { type: "string" },
    model: { type: "string" },
    vehicleType: { type: "string" },
    modelYear: { type: "string" },
    engineNo: { type: "string" },
    registrationDate: { type: "string" },
    rawText: { type: "string" },
  },
  required: [
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
    "rawText",
  ],
  additionalProperties: false,
} as const

type OpenAiResponse = {
  status?: string
  error?: { message?: string }
  output?: Array<{
    type?: string
    content?: Array<{
      type?: string
      text?: string
      refusal?: string
    }>
  }>
}

function getOutputText(response: OpenAiResponse): string {
  for (const output of response.output || []) {
    if (output.type !== "message") continue

    for (const content of output.content || []) {
      if (content.type === "refusal") {
        throw new Error(content.refusal || "Ruhsat görüntüsü analiz edilemedi")
      }
      if (content.type === "output_text" && content.text) {
        return content.text
      }
    }
  }

  throw new Error("OCR sağlayıcısı geçerli bir sonuç döndürmedi")
}

export class OpenAiOcrProvider implements OcrProvider {
  readonly name = "openai"

  constructor(
    private readonly apiKey: string,
    private readonly model = process.env.OPENAI_OCR_MODEL || "gpt-5.4-mini"
  ) {}

  async extractRegistration(imageBuffer: Buffer, mimeType: string): Promise<RegistrationOcrResult> {
    const imageDataUrl = `data:${mimeType};base64,${imageBuffer.toString("base64")}`
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        reasoning: { effort: "low" },
        input: [
          {
            role: "system",
            content: [
              {
                type: "input_text",
                text:
                  "Türk araç tescil belgesindeki alanları yalnızca görüntüde yazdığı şekliyle çıkar. " +
                  "Belgede olmayan veya okunamayan alanlar için boş string döndür. Tahmin etme. " +
                  "Plakayı okunabilir boşluklarla, tarihleri GG/AA/YYYY biçiminde yaz. " +
                  "D.1 MARKASI brand, D.3 TİCARİ ADI model, D.5 CİNSİ vehicleType, " +
                  "D.4 MODEL YILI modelYear, P.5 MOTOR NO engineNo, E ŞASE NO vin, " +
                  "C.1.2 ADI ownerName, C.1.1 SOYADI/TİCARİ ÜNVANI ownerSurname ve " +
                  "I TESCİL TARİHİ registrationDate alanına karşılık gelir.",
              },
            ],
          },
          {
            role: "user",
            content: [
              { type: "input_text", text: "Bu ruhsat fotoğrafındaki araç ve sahip bilgilerini çıkar." },
              { type: "input_image", image_url: imageDataUrl, detail: "high" },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "turkish_vehicle_registration",
            strict: true,
            schema: JSON_SCHEMA,
          },
        },
      }),
    })

    const data = (await response.json()) as OpenAiResponse
    if (!response.ok) {
      throw new Error(data.error?.message || `OCR sağlayıcısı HTTP ${response.status} hatası döndürdü`)
    }
    if (data.status && data.status !== "completed") {
      throw new Error("Ruhsat analizi tamamlanamadı. Lütfen daha net bir fotoğrafla tekrar deneyin.")
    }

    const parsed = OpenAiRegistrationSchema.parse(JSON.parse(getOutputText(data)))
    return toRegistrationResult(parsed, parsed.rawText)
  }
}
