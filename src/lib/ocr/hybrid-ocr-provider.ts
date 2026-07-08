import type { OcrProvider, RegistrationOcrResult, OcrFieldConfidence } from "./types"
import { LOW_CONFIDENCE_THRESHOLD } from "./types"

/**
 * Hibrit ruhsat OCR: PaddleOCR birincil (hızlı/ücretsiz/yerel), Claude Vision fallback.
 *
 * Akış:
 *  1. PaddleOCR 15 alanı okur (+ alan bazlı güven).
 *  2. Güveni eşiğin (minConfidence) altında olan veya boş kalan alanlar "zayıf" sayılır.
 *  3. Zayıf alan YOKSA → Claude HİÇ çağrılmaz (temiz ruhsat = 0 maliyet).
 *  4. Zayıf alan VARSA → tek bir Claude çağrısı yapılır, sadece zayıf alanlar Claude'un
 *     temiz değeriyle değiştirilir; PaddleOCR'ın güvendiği alanlar korunur.
 *
 * Böylece kolay ruhsatların ~%80-90'ı bedava/yerel okunur; yalnızca soluk/kırışık
 * alanlar (ör. kurumsal ünvan) için Claude devreye girer (ucuz Haiku).
 */

// Güven taşıyan 15 alan (rawText hariç).
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

type ConfidenceKey = (typeof CONFIDENCE_KEYS)[number]

export class HybridOcrProvider implements OcrProvider {
  readonly name = "hybrid" as const

  constructor(
    private readonly primary: OcrProvider,
    private readonly fallback: OcrProvider,
    // Bu eşiğin ALTINDA güvenli alanlar Claude'a devredilir. paddle skorları temiz
    // metinde 0.9+; zayıf/kısmi okumalar (~0.7) fallback'i tetikler. Ayarlanabilir.
    private readonly minConfidence: number = LOW_CONFIDENCE_THRESHOLD
  ) {}

  async extractRegistration(imageBuffer: Buffer, mimeType: string): Promise<RegistrationOcrResult> {
    const primary = await this.primary.extractRegistration(imageBuffer, mimeType)

    const weak = CONFIDENCE_KEYS.filter((key) => this.isWeak(key, primary))
    if (weak.length === 0) {
      // PaddleOCR yeterli — Claude çağrılmaz.
      return primary
    }

    let secondary: RegistrationOcrResult
    try {
      secondary = await this.fallback.extractRegistration(imageBuffer, mimeType)
    } catch (err) {
      // Fallback başarısızsa (API/ağ) PaddleOCR sonucuyla graceful devam et.
      console.error("[HYBRID OCR] Claude fallback başarısız, PaddleOCR sonucu kullanılıyor:", err)
      return primary
    }

    // Sadece zayıf alanları Claude'dan al; güçlü PaddleOCR alanlarını koru.
    const merged: RegistrationOcrResult = { ...primary }
    for (const key of weak) {
      merged[key] = secondary[key] as OcrFieldConfidence
    }
    return { ...merged, provider: "hybrid", rawText: primary.rawText }
  }

  private isWeak(key: ConfidenceKey, result: RegistrationOcrResult): boolean {
    const cell = result[key] as OcrFieldConfidence
    // Kurumsal sahipte C.1.2 ADI boş olur (doğru) — ownerSurname doluyken boş ownerName
    // zayıf sayılmaz, yoksa her kurumsal ruhsat gereksiz yere Claude'u tetikler.
    if (key === "ownerName" && !cell.value && (result.ownerSurname as OcrFieldConfidence).value) {
      return false
    }
    if (!cell.value) return true
    return (cell.confidence ?? 0) < this.minConfidence
  }
}
