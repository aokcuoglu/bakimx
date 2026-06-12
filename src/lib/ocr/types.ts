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

export type OcrProviderName = "mock" | "openai" | "deepseek" | "tesseract"

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
  rawText: string
  provider: OcrProviderName
}

export interface OcrProvider {
  readonly name: OcrProviderName
  extractRegistration(imageBuffer: Buffer, mimeType: string): Promise<RegistrationOcrResult>
}