import Anthropic from "@anthropic-ai/sdk"
import type { OcrProvider, RegistrationOcrResult, OcrFieldConfidence } from "./types"
import { RegistrationFieldsSchema, toRegistrationResult } from "./registration-result"
import { z } from "zod"

/**
 * Claude Vision tabanlı ruhsat OCR sağlayıcısı.
 *
 * Görüntüyü doğrudan modele verir (Tesseract yok) ve strict tool use ile modeli
 * tek bir yapılandırılmış JSON nesnesi döndürmeye zorlar — böylece tüm ruhsat
 * alanları garanti şema ile gelir. Yanıt HTTP katmanında doğrulandığı için ayrı
 * bir parse/regex adımı gerekmez.
 */

// Modelin doldurduğu tüm ruhsat alanları. Toleranslı: model bir alanı atlarsa "" olur
// (strict tool use KULLANMIYORUZ — derleme limiti/complexity hatası verir; çıktıyı burada
// zod ile doğruluyoruz, bu yeterli).
const RESULT_SCHEMA = RegistrationFieldsSchema.extend({
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
  rawText: z.string().default(""),
  // Modelin emin olmadığı alan adları — düşük güven uyarısını (⚠) beslemek için.
  uncertainFields: z.array(z.string()).default([]),
})

// OcrFieldConfidence taşıyan alanlar (rawText hariç). Güven skoru bunlara atanır.
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

const TOOL_NAME = "kaydet_ruhsat_alanlari"

// Tool şeması modele alan rehberi verir; tool_choice ile aracı çağırması zorunlu kılınır.
// Çıktı ayrıca zod (RESULT_SCHEMA) ile doğrulanır.
const TOOL_INPUT_SCHEMA: Anthropic.Tool.InputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    plate: { type: "string", description: "A PLAKA — okunabilir boşluklarla, ör. 34 NDV 215" },
    vin: { type: "string", description: "E ŞASE NO (VIN)" },
    ownerName: { type: "string", description: "C.1.2 ADI (araç sahibinin adı)" },
    ownerSurname: { type: "string", description: "C.1.1 SOYADI / TİCARİ ÜNVANI" },
    brand: { type: "string", description: "D.1 MARKASI, ör. FORD" },
    model: { type: "string", description: "D.3 TİCARİ ADI'ndaki model adı, ör. FOCUS" },
    vehicleType: { type: "string", description: "D.5 CİNSİ, ör. OTOMOBİL (AA SEDAN)" },
    modelYear: { type: "string", description: "D.4 MODEL YILI, ör. 2024" },
    engineNo: { type: "string", description: "P.5 MOTOR NO" },
    registrationDate: { type: "string", description: "I TESCİL TARİHİ, GG.AA.YYYY (nokta ayraç)" },
    commercialName: { type: "string", description: "D.3 TİCARİ ADI (ham metin)" },
    fuelType: {
      type: "string",
      description:
        "P.3 YAKIT CİNSİ, ör. DİZEL / BENZİN / LPG / ELEKTRİK. DİKKAT: R RENGİ alanı " +
        "(MAVİ, BEYAZ, SİYAH vb.) DEĞİL — buraya rengi YAZMA.",
    },
    engineDisplacement: { type: "string", description: "P.1 SİLİNDİR HACMİ (cm³, sadece sayı), ör. 1499" },
    enginePower: { type: "string", description: "P.2 MOTOR GÜCÜ, kW birimiyle, ör. 84 kW" },
    inspectionValidUntil: {
      type: "string",
      description: "Z.2 DİĞER BİLGİLER içindeki 'mua.geç.trh' muayene geçerlilik tarihi, GG.AA.YYYY (nokta ayraç)",
    },
    rawText: { type: "string", description: "Belgede görünen tüm metnin düz transkripsiyonu (denetim için)" },
    uncertainFields: {
      type: "array",
      description: "Emin olmadığın alan adları (yukarıdaki anahtarlardan). Netse boş bırak.",
      items: { type: "string", enum: [...CONFIDENCE_KEYS] },
    },
  },
  required: [...CONFIDENCE_KEYS, "rawText", "uncertainFields"],
}

const SYSTEM_PROMPT =
  "Sen bir Türk araç tescil belgesi (ruhsat) okuma uzmanısın. Görseldeki alanları " +
  "YALNIZCA belgede yazdığı şekilde çıkar; bilgi uydurma. Okunamayan veya belgede " +
  "olmayan her alan için boş string döndür. TÜM tarihleri GG.AA.YYYY biçiminde (nokta ayraç) ver. " +
  "Silindir hacmini (P.1) yalnızca sayı olarak, motor gücünü (P.2) kW birimiyle yaz. " +
  "Yakıt cinsini (P.3: DİZEL/BENZİN/LPG) rengi (R: MAVİ vb.) ile KARIŞTIRMA. " +
  "Emin olmadığın alanları uncertainFields dizisine ekle. Sonucu yalnızca " +
  `${TOOL_NAME} aracını çağırarak döndür.`

// Anthropic'in kabul ettiği görüntü MIME türleri; diğerleri jpeg'e çekilir (normalize zaten jpeg üretir).
const SUPPORTED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"])

export class AnthropicOcrProvider implements OcrProvider {
  readonly name = "anthropic" as const
  private readonly client: Anthropic

  constructor(
    apiKey: string,
    private readonly model: string
  ) {
    this.client = new Anthropic({ apiKey })
  }

  async extractRegistration(imageBuffer: Buffer, mimeType: string): Promise<RegistrationOcrResult> {
    const mediaType = SUPPORTED_MEDIA_TYPES.has(mimeType) ? mimeType : "image/jpeg"

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: [
        {
          name: TOOL_NAME,
          description: "Ruhsattan çıkarılan alanları yapılandırılmış olarak kaydet.",
          input_schema: TOOL_INPUT_SCHEMA,
        },
      ],
      tool_choice: { type: "tool", name: TOOL_NAME },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: imageBuffer.toString("base64"),
              },
            },
            {
              type: "text",
              text: "Bu ruhsat fotoğrafındaki tüm araç ve sahip bilgilerini çıkar.",
            },
          ],
        },
      ],
    })

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === TOOL_NAME
    )
    if (!toolUse) {
      throw new Error(
        "Claude ruhsat alanlarını oluşturamadı. Lütfen daha net bir fotoğrafla tekrar deneyin."
      )
    }

    const parsed = RESULT_SCHEMA.parse(toolUse.input)
    const base = toRegistrationResult(parsed, parsed.rawText)

    // Emin olunmayan alanları eşiğin altına çek; gerisini yüksek güvenle işaretle.
    const uncertain = new Set(parsed.uncertainFields)
    for (const key of CONFIDENCE_KEYS) {
      const cell = base[key] as OcrFieldConfidence
      cell.confidence = uncertain.has(key) ? 0.5 : 0.95
    }

    return { ...base, provider: "anthropic" }
  }
}
