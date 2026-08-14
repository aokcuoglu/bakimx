import type {
  OcrProvider,
  RegistrationOcrResult,
  OcrFieldConfidence,
  PartBoxOcrResult,
  VinOcrResult,
} from "./types"

function field(value: string, confidence?: number): OcrFieldConfidence {
  return { value, confidence }
}

const MOCK_REGISTRATION_DATA: Omit<RegistrationOcrResult, "provider"> = {
  plate: field("34 ABC 123", 0.92),
  vin: field("1HGBH41JXMN109186", 0.88),
  ownerName: field("Mehmet", 0.85),
  ownerSurname: field("Yılmaz", 0.87),
  identityOrTaxNumber: field("11111111111", 0.93),
  brand: field("Toyota", 0.90),
  model: field("Corolla", 0.89),
  vehicleType: field("Binek", 0.82),
  modelYear: field("2021", 0.91),
  engineNo: field("2ZRFAE187174", 0.78),
  registrationDate: field("15.03.2021", 0.75),
  commercialName: field("Corolla Hybrid", 0.80),
  fuelType: field("Benzin", 0.84),
  engineDisplacement: field("1798", 0.79),
  enginePower: field("72 kW", 0.77),
  inspectionValidUntil: field("15.03.2027", 0.73),
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

const MOCK_PARTBOX_DATA: Omit<PartBoxOcrResult, "provider"> = {
  partName: field("Yağ filtresi", 0.9),
  brand: field("SETA", 0.88),
  partNumbers: [
    { value: "STO-539", label: "SETA CODE", confidence: 0.9 },
    { value: "04152-YZZA6", label: "OEM NO", confidence: 0.86 },
    { value: "HU 6006 Z", label: "MANN NO", confidence: 0.6 },
  ],
  rawText: "",
}

export class MockOcrProvider implements OcrProvider {
  readonly name = "mock" as const

  async extractRegistration(_imageBuffer: Buffer, _mimeType: string): Promise<RegistrationOcrResult> {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    return { ...MOCK_REGISTRATION_DATA, provider: "mock" }
  }

  async extractPartBox(_imageBuffer: Buffer, _mimeType: string): Promise<PartBoxOcrResult> {
    await new Promise((resolve) => setTimeout(resolve, 1200))
    return { ...MOCK_PARTBOX_DATA, provider: "mock" }
  }

  async extractVin(_imageBuffer: Buffer, _mimeType: string): Promise<VinOcrResult> {
    await new Promise((resolve) => setTimeout(resolve, 900))
    // Ruhsat mock'uyla AYNI VIN: demo akışta cam taraması ile ruhsat taraması
    // aynı araca düşsün (seed verisiyle de eşleşir).
    return { rawVin: MOCK_REGISTRATION_DATA.vin.value, confident: true, provider: "mock" }
  }
}

let _mockProvider: MockOcrProvider | null = null

export function getMockOcrProvider(): MockOcrProvider {
  if (!_mockProvider) {
    _mockProvider = new MockOcrProvider()
  }
  return _mockProvider
}
