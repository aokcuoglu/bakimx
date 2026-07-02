import Anthropic from "@anthropic-ai/sdk"
import type { AiProvider, ServiceAdvisorInput, ServiceAdvisorResult } from "./types"

const ADVISOR_SYSTEM = "Sen bir oto servis danışmanısın. Sadece JSON formatında yanıt ver."

function buildPrompt(input: ServiceAdvisorInput): string {
  const prevOrders = input.previousWorkOrders.length > 0
    ? input.previousWorkOrders
        .map(
          (o) =>
            `- ${o.workOrderNo || "İş emri"} (${new Date(o.createdAt).toLocaleDateString("tr-TR")}): ${o.customerComplaint} — Kalemler: ${o.items.map((i) => i.name).join(", ") || "yok"}`
        )
        .join("\n")
    : "Yok"

  return `Sen bir oto servis danışmanısın. Müşteri şikayetini ve araç bilgilerini analiz ederek profesyonel servis önerileri sun.

Araç: ${input.vehicleBrand} ${input.vehicleModel}
Kilometre: ${input.mileage != null ? input.mileage.toLocaleString("tr-TR") + " km" : "Belirtilmemiş"}
Müşteri Şikayeti: ${input.customerComplaint}

Önceki İş Emirleri:
${prevOrders}

Aşağıdaki formatta JSON yanıt ver (dışında hiçbir metin ekleme):
{
  "suggestedInspections": ["kontrol1", "kontrol2"],
  "suggestedLabor": ["işçilik1", "işçilik2"],
  "suggestedParts": ["parça1", "parça2"],
  "customerDescription": "Müşteriye uygun profesyonel açıklama",
  "internalNote": "Servis içi not",
  "missingInfoWarnings": ["eksik bilgi uyarısı"]
}

Kurallar:
- suggestedInspections: Araç marka/model ve KM bazlı spesifik kontroller
- suggestedLabor: Muhtemel işçilikler (Türkçe, kısa ve net)
- suggestedParts: Muhtemel parçalar (marka/model spesifik olursa iyi)
- customerDescription: Müşteriye hitaben profesyonel, sıcak dil
- internalNote: Teknisyen içi kısa not
- missingInfoWarnings: Eksik bilgi varsa uyarı (KM yoksa, şikayet belirsizse vb.)
- Tüm metinler Türkçe
- Sadece JSON döndür, başka hiçbir şey ekleme`
}

export class OpenAiAdvisorProvider implements AiProvider {
  readonly name = "openai" as const

  constructor(
    private apiKey: string,
    private model: string
  ) {}

  async suggest(input: ServiceAdvisorInput): Promise<ServiceAdvisorResult> {
    const prompt = buildPrompt(input)

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: "Sen bir oto servis danışmanısın. Sadece JSON formatında yanıt ver." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`OpenAI API hatası (${res.status}): ${body}`)
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || ""
    const parsed = parseAiResponse(content)

    return {
      ...parsed,
      provider: "openai",
      rawResponse: content,
    }
  }
}

export class AnthropicAdvisorProvider implements AiProvider {
  readonly name = "anthropic" as const
  private readonly client: Anthropic

  constructor(
    apiKey: string,
    private model: string
  ) {
    this.client = new Anthropic({ apiKey })
  }

  async suggest(input: ServiceAdvisorInput): Promise<ServiceAdvisorResult> {
    const prompt = buildPrompt(input)

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1500,
      system: ADVISOR_SYSTEM,
      messages: [{ role: "user", content: prompt }],
    })

    const content = response.content.find((b) => b.type === "text")?.text ?? ""
    const parsed = parseAiResponse(content)

    return {
      ...parsed,
      provider: "anthropic",
      rawResponse: content,
    }
  }
}

function parseAiResponse(content: string): Omit<ServiceAdvisorResult, "provider" | "rawResponse"> {
  let jsonStr = content.trim()
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim()
  }

  try {
    const obj = JSON.parse(jsonStr)
    return {
      suggestedInspections: Array.isArray(obj.suggestedInspections) ? obj.suggestedInspections.filter(String) : [],
      suggestedLabor: Array.isArray(obj.suggestedLabor) ? obj.suggestedLabor.filter(String) : [],
      suggestedParts: Array.isArray(obj.suggestedParts) ? obj.suggestedParts.filter(String) : [],
      customerDescription: typeof obj.customerDescription === "string" ? obj.customerDescription : "",
      internalNote: typeof obj.internalNote === "string" ? obj.internalNote : "",
      missingInfoWarnings: Array.isArray(obj.missingInfoWarnings) ? obj.missingInfoWarnings.filter(String) : [],
    }
  } catch {
    return {
      suggestedInspections: [],
      suggestedLabor: [],
      suggestedParts: [],
      customerDescription: "AI yanıtı ayrıştırılamadı. Lütfen manuel olarak kontrol ediniz.",
      internalNote: `JSON parse hatası. Ham yanıt: ${content.slice(0, 200)}`,
      missingInfoWarnings: ["AI yanıtı ayrıştırılamadı — manuel kontrol gerekli"],
    }
  }
}