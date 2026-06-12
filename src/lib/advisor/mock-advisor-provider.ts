import type { AiProvider, ServiceAdvisorInput, ServiceAdvisorResult } from "./types"

type MockSuggestion = {
  suggestedInspections: string[]
  suggestedLabor: string[]
  suggestedParts: string[]
  customerDescription: string
  internalNote: string
  missingInfoWarnings: string[]
}

const MOCK_SUGGESTIONS: Record<string, MockSuggestion> = {
  fren: {
    suggestedInspections: ["Fren balataları kontrolü", "Fren diskleri kalınlık ölçümü", "Fren hidroliği seviye kontrolü", "Fren hortumları göz kontrolü"],
    suggestedLabor: ["Ön balata değişimi", "Arka balata değişimi", "Fren hidroliği değişimi"],
    suggestedParts: ["Ön fren balata seti", "Arka fren balata seti", "Fren hidroliği DOT 4"],
    customerDescription: "Aracınızın fren sistemi detaylı şekilde incelenmiştir. Fren balatalarında ve disklerde aşınma tespit edilmiş olup, güvenliğiniz için balata değişimi önerilmektedir.",
    internalNote: "Müşteri fren sesi şikayetiyle geldi. Balatalar muhtemelen limitin altında. Disk kontrolü de yapılmalı.",
    missingInfoWarnings: [],
  },
  yağ: {
    suggestedInspections: ["Motor yağ seviye kontrolü", "Yağ filtresi durumu", "Hava filtresi kontrolü", "Soğutma suyu seviye kontrolü"],
    suggestedLabor: ["Motor yağı değişimi", "Yağ filtresi değişimi", "Hava filtresi değişimi"],
    suggestedParts: ["Motor yağı 5W-30", "Yağ filtresi", "Hava filtresi"],
    customerDescription: "Aracınızın periyodik bakımı için motor yağı ve filtre değişimi önerilmektedir. Yağ değişimi sonrası tüm sıvı seviyeleri kontrol edilecektir.",
    internalNote: "Periyodik yağ bakımı gerekiyor. KM göre bakım aralığı kontrol edilmeli.",
    missingInfoWarnings: [],
  },
  klima: {
    suggestedInspections: ["Klima gazı basınç ölçümü", "Klima kompresörü kontrolü", "Klima hortumları sızıntı kontrolü", "Kabin filtresi kontrolü"],
    suggestedLabor: ["Klima gazı dolumu", "Kabin filtresi değişimi"],
    suggestedParts: ["Klima gazı R134a", "Kabin filtresi"],
    customerDescription: "Aracınızın klima sistemi detaylı şekilde incelenmiştir. Klima gazı eksikliği tespit edilmiş olup, dolum ve sızıntı kontrolü önerilmektedir.",
    internalNote: "Klima yeterince soğutmuyor. Gaz kaçak kontrolü yapılmalı.",
    missingInfoWarnings: [],
  },
  motor: {
    suggestedInspections: ["Motor arıza kodu okuma", "Motor yağ basıncı kontrolü", "Soğutma sistemi basınç testi", "Egzoz gazı emisyon ölçümü", "V kayışı kontrolü"],
    suggestedLabor: ["Motor arıza teşhisi", "Buji değişimi", "V kayışı değişimi"],
    suggestedParts: ["Buji seti", "V kayışı", "Soğutma suyu"],
    customerDescription: "Aracınızın motorunda arıza tespiti için detaylı teşhis yapılmıştır. Motor arıza kodları okunacak ve gerekli onarımlar uygulanacaktır.",
    internalNote: "Motor arıza ışığı yanıyor. OBD taraması yapılmalı, sonra teşhis netleşecek.",
    missingInfoWarnings: ["Motor arıza kodu (OBD) bilgisi gerekiyor"],
  },
  süspansiyon: {
    suggestedInspections: ["Amortisör kontrolü", "Helezon yay kontrolü", "Rotbaç ve rotil kontrolü", "Lastik aşınma deseni kontrolü", "Rotil ayarı kontrolü"],
    suggestedLabor: ["Amortisör değişimi", "Rotbaç değişimi", "Rotil ayarı"],
    suggestedParts: ["Ön amortisör seti", "Rotbaç", "Rota çubuğu ucu"],
    customerDescription: "Aracınızın süspansiyon sistemi detaylı şekilde incelenmiştir. Amortisörlerde ve bağlantı elemanlarında aşınma tespit edilmiştir.",
    internalNote: "Müşteri sarsıntı şikayetiyle geldi. Amortisör ve rotbaç kontrolü acil.",
    missingInfoWarnings: [],
  },
}

const DEFAULT_SUGGESTION: Omit<ServiceAdvisorResult, "provider"> = {
  suggestedInspections: ["Genel araç kontrolü", "Motor yağ seviye kontrolü", "Lastik durumu kontrolü", "Fren sistemi kontrolü"],
  suggestedLabor: ["Genel araç muayenesi", "Tanısal kontrol"],
  suggestedParts: [],
  customerDescription: "Aracınız şikayetiniz doğrultusunda detaylı şekilde incelenecektir. Gerekli kontroller yapıldıktan sonra size bilgilendirme yapılacaktır.",
  internalNote: "Müşteri şikayeti doğrultusunda genel kontrol yapılacak.",
  missingInfoWarnings: [],
}

function matchSuggestion(complaint: string): MockSuggestion {
  const lower = complaint.toLowerCase()
  for (const [keyword, suggestion] of Object.entries(MOCK_SUGGESTIONS)) {
    if (lower.includes(keyword)) return suggestion
  }
  if (lower.includes("ses") || lower.includes("gürültü")) return MOCK_SUGGESTIONS.motor
  if (lower.includes("vites") || lower.includes("şanzıman")) return MOCK_SUGGESTIONS.motor
  if (lower.includes("sarsıntı") || lower.includes("zıplama")) return MOCK_SUGGESTIONS.süspansiyon
  if (lower.includes("ısıtma") || lower.includes("sobele")) return MOCK_SUGGESTIONS.klima
  return DEFAULT_SUGGESTION
}

export class MockAdvisorProvider implements AiProvider {
  readonly name = "mock" as const

  async suggest(input: ServiceAdvisorInput): Promise<ServiceAdvisorResult> {
    await new Promise((resolve) => setTimeout(resolve, 1200))

    const base = matchSuggestion(input.customerComplaint)

    const warnings: string[] = [...(base.missingInfoWarnings || [])]
    if (!input.mileage && input.mileage !== 0) {
      warnings.push("Araç kilometresi belirtilmemiş — periyodik bakım önerileri eksik olabilir")
    }
    if (!input.vehicleBrand || !input.vehicleModel) {
      warnings.push("Araç marka/model bilgisi eksik — parça önerileri spesifik olmayabilir")
    }

    return {
      ...base,
      missingInfoWarnings: warnings,
      provider: "mock",
    }
  }
}

let _mockProvider: MockAdvisorProvider | null = null

export function getMockAdvisorProvider(): MockAdvisorProvider {
  if (!_mockProvider) {
    _mockProvider = new MockAdvisorProvider()
  }
  return _mockProvider
}