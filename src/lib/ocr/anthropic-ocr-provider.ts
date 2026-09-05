import Anthropic from "@anthropic-ai/sdk"
import type {
  OcrProvider,
  OcrRequestOptions,
  RegistrationOcrResult,
  OcrFieldConfidence,
  PartBoxOcrResult,
  VinOcrResult,
} from "./types"
import { RegistrationFieldsSchema, toRegistrationResult } from "./registration-result"
import { PartBoxFieldsSchema, toPartBoxResult } from "./part-box-result"
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
  "identityOrTaxNumber",
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
    identityOrTaxNumber: {
      type: "string",
      description: "C.4 T.C. KİMLİK / VERGİ NO (yalnız rakamlar)",
    },
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
    // rawText (tam belge transkripsiyonu) KASITLI olarak yok: çıktı token'larının büyük
    // kısmıydı → gecikme/maliyet. Yalnız OcrLog audit'ine yazılıyordu, client'a zaten
    // gitmiyor (route.ts strip ediyor). Yapılandırılmış alanlar audit için yeterli.
    uncertainFields: {
      type: "array",
      description: "Emin olmadığın alan adları (yukarıdaki anahtarlardan). Netse boş bırak.",
      items: { type: "string", enum: [...CONFIDENCE_KEYS] },
    },
  },
  required: [...CONFIDENCE_KEYS, "uncertainFields"],
}

const SYSTEM_PROMPT =
  "Sen bir Türk araç tescil belgesi (ruhsat) okuma uzmanısın. Görseldeki alanları " +
  "YALNIZCA belgede yazdığı şekilde çıkar; bilgi uydurma. Okunamayan veya belgede " +
  "olmayan her alan için boş string döndür. TÜM tarihleri GG.AA.YYYY biçiminde (nokta ayraç) ver. " +
  "Silindir hacmini (P.1) yalnızca sayı olarak, motor gücünü (P.2) kW birimiyle yaz. " +
  "Yakıt cinsini (P.3: DİZEL/BENZİN/LPG) rengi (R: MAVİ vb.) ile KARIŞTIRMA. " +
  "C.4 alanındaki T.C. kimlik/vergi numarasını yalnız rakamlarla yaz. " +
  "Emin olmadığın alanları uncertainFields dizisine ekle. Sonucu yalnızca " +
  `${TOOL_NAME} aracını çağırarak döndür.`

const PARTBOX_TOOL_NAME = "kaydet_parca_kutusu_alanlari"

const PARTBOX_TOOL_INPUT_SCHEMA: Anthropic.Tool.InputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    partName: {
      type: "string",
      description:
        "Parçanın Türkçe adı/tipi, ör. 'Yağ filtresi', 'Ön fren balatası'. Kutuda İngilizce yazıyorsa " +
        "(OIL FILTER) Türkçe'ye çevir. Emin değilsen kutudaki orijinal ifadeyi bırak.",
    },
    brand: { type: "string", description: "Üretici/marka adı, ör. SETA, BOSCH, MANN. Yoksa boş bırak." },
    partNumbers: {
      type: "array",
      description:
        "Kutu üzerinde okunan TÜM parça/kod numaraları. Her numara ayrı bir öğe. " +
        "OEM NO, marka kodu (ör. SETA CODE), çapraz referanslar (MANN NO, BOSCH NO) ayrı ayrı listelenir.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          value: { type: "string", description: "Numaranın kendisi, ör. 04152-YZZA6" },
          label: { type: "string", description: "Numaranın kaynağı/etiketi, ör. OEM NO, SETA CODE, MANN NO" },
          confidence: { type: "number", description: "0-1 arası okuma güveni (opsiyonel)" },
        },
        required: ["value", "label"],
      },
    },
    uncertainFields: {
      type: "array",
      description: "Emin olmadığın alan adları ('partName' / 'brand'). Netse boş bırak.",
      items: { type: "string", enum: ["partName", "brand"] },
    },
  },
  required: ["partName", "brand", "partNumbers", "uncertainFields"],
}

const PARTBOX_SYSTEM_PROMPT =
  "Sen bir otomotiv yedek parça kutusu okuma uzmanısın. Görseldeki parçanın adını/tipini, marka " +
  "adını ve kutu üzerindeki TÜM kod/numara alanlarını (OEM NO, marka kodu, MANN/BOSCH gibi çapraz " +
  "referanslar) çıkar. Bilgi UYDURMA; okunamayan alanı boş bırak. Her numarayı, kaynağını belirten " +
  "bir etiketle (label) birlikte ayrı öğe olarak ver. Parça adını Türkçe yaz; emin değilsen kutudaki " +
  `orijinal ifadeyi koru. Sonucu yalnızca ${PARTBOX_TOOL_NAME} aracını çağırarak döndür.`

const VIN_TOOL_NAME = "kaydet_sase_no"

const VIN_TOOL_INPUT_SCHEMA: Anthropic.Tool.InputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    vin: {
      type: "string",
      description:
        "Görseldeki 17 haneli şase numarası (VIN), boşluksuz ve büyük harf. " +
        "Okunamıyorsa veya 17 hane değilse boş string döndür.",
    },
    confident: {
      type: "boolean",
      description: "17 hanenin tamamını net okuduysan true; tek bir karakterden bile şüphen varsa false.",
    },
  },
  required: ["vin", "confident"],
}

const VIN_RESULT_SCHEMA = z.object({
  vin: z.string().default(""),
  confident: z.boolean().default(false),
})

const VIN_SYSTEM_PROMPT =
  "Sen araç şase numarası (VIN) okuma uzmanısın. Görsel, aracın ön camının altındaki şase " +
  "plakasının veya kaportaya vurulmuş şase numarasının fotoğrafıdır. " +
  "VIN tam 17 hanedir ve ISO 3779 gereği içinde I, O, Q harfleri BULUNMAZ — bu konumlarda " +
  "gördüğün karakterler 1 ve 0 rakamlarıdır. Yalnızca gördüğünü yaz, eksik haneyi TAMAMLAMA " +
  "ve numara uydurma. Fotoğrafta 17 haneyi net okuyamıyorsan vin alanını boş bırak. " +
  "Barkod, üretim tarihi, ağırlık gibi diğer satırları değil, yalnızca şase numarasını al. " +
  `Sonucu yalnızca ${VIN_TOOL_NAME} aracını çağırarak döndür.`

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

  async extractRegistration(imageBuffer: Buffer, mimeType: string, options?: OcrRequestOptions): Promise<RegistrationOcrResult> {
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
    }, options ? { signal: options.signal, timeout: options.timeoutMs, maxRetries: options.maxRetries } : undefined)

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

  async extractPartBox(imageBuffer: Buffer, mimeType: string): Promise<PartBoxOcrResult> {
    const mediaType = SUPPORTED_MEDIA_TYPES.has(mimeType) ? mimeType : "image/jpeg"

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: PARTBOX_SYSTEM_PROMPT,
      tools: [
        {
          name: PARTBOX_TOOL_NAME,
          description: "Parça kutusundan çıkarılan alanları yapılandırılmış olarak kaydet.",
          input_schema: PARTBOX_TOOL_INPUT_SCHEMA,
        },
      ],
      tool_choice: { type: "tool", name: PARTBOX_TOOL_NAME },
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
              text: "Bu parça kutusundaki parça adını, markayı ve tüm numaraları çıkar.",
            },
          ],
        },
      ],
    })

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock =>
        block.type === "tool_use" && block.name === PARTBOX_TOOL_NAME
    )
    if (!toolUse) {
      throw new Error("Claude parça kutusu alanlarını oluşturamadı. Lütfen daha net bir fotoğrafla tekrar deneyin.")
    }

    const fields = PartBoxFieldsSchema.parse(toolUse.input)
    return toPartBoxResult(fields, "anthropic")
  }

  async extractVin(imageBuffer: Buffer, mimeType: string): Promise<VinOcrResult> {
    const mediaType = SUPPORTED_MEDIA_TYPES.has(mimeType) ? mimeType : "image/jpeg"

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 256,
      system: VIN_SYSTEM_PROMPT,
      tools: [
        {
          name: VIN_TOOL_NAME,
          description: "Görselden okunan şase numarasını kaydet.",
          input_schema: VIN_TOOL_INPUT_SCHEMA,
        },
      ],
      tool_choice: { type: "tool", name: VIN_TOOL_NAME },
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
            { type: "text", text: "Bu fotoğraftaki 17 haneli şase numarasını (VIN) oku." },
          ],
        },
      ],
    })

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === VIN_TOOL_NAME
    )
    // Araç çağrılmadıysa okuma başarısızdır; boş sonuç dön, HTTP katmanı 422 üretsin.
    if (!toolUse) return { rawVin: "", confident: false, provider: "anthropic" }

    const fields = VIN_RESULT_SCHEMA.parse(toolUse.input)
    return { rawVin: fields.vin, confident: fields.confident, provider: "anthropic" }
  }
}
