export const LOW_CONFIDENCE_THRESHOLD = 0.7

export const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
])

export const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024
export const MAX_BODY_SIZE_BYTES = 12 * 1024 * 1024

// "paddle" ve "hybrid" 2026-07-05'te emekli edildi (PaddleOCR sidecar kaldırıldı).
// Eski OcrLog satırlarında bu değerler DB'de kalmış olabilir; onları yalnız
// gösteren yerler ham değere düşer (bkz. smart-capture-registration.tsx).
export type OcrProviderName = "mock" | "openai" | "anthropic"

export interface OcrFieldConfidence {
  value: string
  confidence?: number
}

export interface RegistrationOcrResult {
  plate: OcrFieldConfidence
  vin: OcrFieldConfidence
  ownerName: OcrFieldConfidence
  ownerSurname: OcrFieldConfidence
  brand: OcrFieldConfidence
  model: OcrFieldConfidence
  vehicleType: OcrFieldConfidence
  modelYear: OcrFieldConfidence
  engineNo: OcrFieldConfidence
  registrationDate: OcrFieldConfidence
  // Ruhsat teknik alanları (D.3 / P.3 / P.1 / P.2 / Z.2). Vision OCR bunları da okur.
  commercialName: OcrFieldConfidence
  fuelType: OcrFieldConfidence
  engineDisplacement: OcrFieldConfidence
  enginePower: OcrFieldConfidence
  inspectionValidUntil: OcrFieldConfidence
  rawText: string
  provider: OcrProviderName
}

export interface PartNumberSuggestion {
  value: string
  label: string
  confidence?: number
}

export interface PartBoxOcrResult {
  partName: OcrFieldConfidence
  brand: OcrFieldConfidence
  partNumbers: PartNumberSuggestion[]
  rawText: string
  provider: OcrProviderName
}

/**
 * Cam altındaki şase (VIN) plakasından tek alanlık okuma sonucu. Ruhsat okumasının
 * aksine tek bir değer döner; doğrulama/normalizasyon çağıran tarafta
 * `parseVinFromText` ile yapılır (sağlayıcıdan bağımsız tek kapı).
 */
export interface VinOcrResult {
  /** Sağlayıcının okuduğu ham metin (henüz VIN olarak doğrulanmamış). */
  rawVin: string
  /** Sağlayıcı bu okumadan emin değilse false. */
  confident: boolean
  provider: OcrProviderName
}

export interface OcrProvider {
  readonly name: OcrProviderName
  extractRegistration(imageBuffer: Buffer, mimeType: string): Promise<RegistrationOcrResult>
  extractPartBox?(imageBuffer: Buffer, mimeType: string): Promise<PartBoxOcrResult>
  extractVin?(imageBuffer: Buffer, mimeType: string): Promise<VinOcrResult>
}