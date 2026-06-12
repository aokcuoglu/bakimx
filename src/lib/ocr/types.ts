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
}

export interface OcrProvider {
  readonly name: string
  extractRegistration(imageBuffer: Buffer, mimeType: string): Promise<RegistrationOcrResult>
}