import type { OcrProvider, RegistrationOcrResult } from "./types"
import { extractRegistrationText, terminateTesseractWorker } from "./tesseract-text-extractor"
import { RegistrationFieldsSchema, toRegistrationResult } from "./registration-result"

function parseRawTextToFields(rawText: string): Record<string, string> {
  const fields: Record<string, string> = {
    plate: "",
    vin: "",
    ownerName: "",
    ownerSurname: "",
    brand: "",
    model: "",
    vehicleType: "",
    modelYear: "",
    engineNo: "",
    registrationDate: "",
  }

  const lines = rawText.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const labelValueSplit = trimmed.match(/[:：]\s*(.+)/)
    if (!labelValueSplit) continue

    const value = labelValueSplit[1].trim()
    const label = trimmed.substring(0, trimmed.length - labelValueSplit[0].length).trim()

    const labelLower = label.toLowerCase().replace(/[^a-z0-9ğüşıöç]/g, "")

    if (/plaka/.test(labelLower) || /^p[^0-9]*\d/.test(labelLower)) {
      fields.plate = value
    } else if (/sase|şase|vin/.test(labelLower) || /^e\b/.test(labelLower)) {
      fields.vin = value
    } else if (/(?:soyad|soyadi|ticariunvan)/.test(labelLower) || /^c[^0-9]*1[^0-9]*1/.test(labelLower)) {
      fields.ownerSurname = value
    } else if (/(?:ad|adi)\b/.test(labelLower) && !/soyad/.test(labelLower) || /^c[^0-9]*1[^0-9]*2/.test(labelLower)) {
      fields.ownerName = value
    } else if (/(?:marka|markasi)/.test(labelLower) || /^d[^0-9]*1\b/.test(labelLower)) {
      fields.brand = value
    } else if (/(?:ticariad|model)/.test(labelLower) || /^d[^0-9]*3\b/.test(labelLower)) {
      fields.model = value
    } else if (/(?:cins|cinsi)/.test(labelLower) || /^d[^0-9]*5\b/.test(labelLower)) {
      fields.vehicleType = value
    } else if (/(?:modelyil|model.yili)/.test(labelLower) || /^d[^0-9]*4\b/.test(labelLower)) {
      fields.modelYear = value
    } else if (/(?:motorno)/.test(labelLower) || /^p[^0-9]*5\b/.test(labelLower)) {
      fields.engineNo = value
    } else if (/(?:tesciltarih|tesciltarihi)/.test(labelLower) || /^i\b/.test(labelLower)) {
      fields.registrationDate = value
    }
  }

  return fields
}

export class TesseractOcrProvider implements OcrProvider {
  readonly name = "tesseract" as const

  async extractRegistration(imageBuffer: Buffer, _mimeType: string): Promise<RegistrationOcrResult> {
    const rawText = await extractRegistrationText(imageBuffer)

    if (!rawText.trim()) {
      throw new Error("Ruhsat fotoğrafından okunabilir metin çıkarılamadı. Lütfen daha net bir fotoğraf yükleyin.")
    }

    const rawFields = parseRawTextToFields(rawText)

    const fields = RegistrationFieldsSchema.parse({
      plate: rawFields.plate || "",
      vin: rawFields.vin || "",
      ownerName: rawFields.ownerName || "",
      ownerSurname: rawFields.ownerSurname || "",
      brand: rawFields.brand || "",
      model: rawFields.model || "",
      vehicleType: rawFields.vehicleType || "",
      modelYear: rawFields.modelYear || "",
      engineNo: rawFields.engineNo || "",
      registrationDate: rawFields.registrationDate || "",
    })

    const hasAnyField = Object.values(fields).some((v) => v.trim().length > 0)
    if (!hasAnyField) {
      throw new Error("Tesseract ruhsat alanlarını oluşturamadı. Lütfen fotoğrafı yeniden deneyin veya farklı bir OCR sağlayıcısı seçin.")
    }

    const result = toRegistrationResult(fields, rawText)
    return {
      ...result,
      plate: { ...result.plate, confidence: result.plate.value ? 0.5 : 0 },
      vin: { ...result.vin, confidence: result.vin.value ? 0.5 : 0 },
      ownerName: { ...result.ownerName, confidence: result.ownerName.value ? 0.4 : 0 },
      ownerSurname: { ...result.ownerSurname, confidence: result.ownerSurname.value ? 0.4 : 0 },
      brand: { ...result.brand, confidence: result.brand.value ? 0.5 : 0 },
      model: { ...result.model, confidence: result.model.value ? 0.5 : 0 },
      vehicleType: { ...result.vehicleType, confidence: result.vehicleType.value ? 0.4 : 0 },
      modelYear: { ...result.modelYear, confidence: result.modelYear.value ? 0.5 : 0 },
      engineNo: { ...result.engineNo, confidence: result.engineNo.value ? 0.4 : 0 },
      registrationDate: { ...result.registrationDate, confidence: result.registrationDate.value ? 0.4 : 0 },
      provider: "tesseract",
    }
  }
}

export { terminateTesseractWorker }