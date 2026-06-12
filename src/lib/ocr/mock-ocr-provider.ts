import type { OcrProvider, RegistrationOcrResult, OcrFieldConfidence } from "./types"

function field(value: string, confidence?: number): OcrFieldConfidence {
  return { value, confidence }
}

const MOCK_REGISTRATION_DATA: Omit<RegistrationOcrResult, "provider"> = {
  plate: field("34 ABC 123", 0.92),
  vin: field("1HGBH41JXMN109186", 0.88),
  ownerName: field("Mehmet", 0.85),
  ownerSurname: field("Yılmaz", 0.87),
  brand: field("Toyota", 0.90),
  model: field("Corolla", 0.89),
  vehicleType: field("Binek", 0.82),
  modelYear: field("2021", 0.91),
  engineNo: field("2ZRFAE187174", 0.78),
  registrationDate: field("15.03.2021", 0.75),
  rawText: `T.C. ULAŞTIRMA VE ALTYAPI BAKANLIĞI
ARAÇ TESCİL BELGESİ
Plaka: 34 ABC 123
Şase No: 1HGBH41JXMN109186
Marka: Toyota
Model: Corolla
Tip: Binek
Motor No: 2ZRFAE187174
Model Yılı: 2021
Araç Sahibi: Mehmet Yılmaz
Tescil Tarihi: 15.03.2021`,
}

export class MockOcrProvider implements OcrProvider {
  readonly name = "mock" as const

  async extractRegistration(_imageBuffer: Buffer, _mimeType: string): Promise<RegistrationOcrResult> {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    return { ...MOCK_REGISTRATION_DATA, provider: "mock" }
  }
}

let _mockProvider: MockOcrProvider | null = null

export function getMockOcrProvider(): MockOcrProvider {
  if (!_mockProvider) {
    _mockProvider = new MockOcrProvider()
  }
  return _mockProvider
}