import type { AiProvider, AiProviderName } from "./types"
import { getMockAdvisorProvider } from "./mock-advisor-provider"
import { OpenAiAdvisorProvider, DeepSeekAdvisorProvider } from "./ai-advisor-providers"

let _provider: AiProvider | null = null

function parseProviderName(value: string | undefined): AiProviderName {
  const normalized = (value || "").toLowerCase().trim()
  if (!normalized || normalized === "mock") return "mock"
  if (normalized === "deepseek") return "deepseek"
  if (normalized === "openai") return "openai"
  throw new Error(
    `Bilinmeyen AI sağlayıcısı: "${value}". Desteklenen değerler: mock (varsayılan), openai, deepseek. ` +
      "AI_PROVIDER ortam değişkenini kontrol ediniz."
  )
}

export async function getAdvisorProvider(): Promise<AiProvider> {
  if (_provider) return _provider

  const providerName = parseProviderName(process.env.AI_PROVIDER)

  if (providerName === "mock") {
    _provider = getMockAdvisorProvider()
    return _provider
  }

  if (providerName === "openai") {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error(
        "OpenAI ile servis danışmanı için OPENAI_API_KEY tanımlanmalıdır. " +
          "Demo verisi kullanmak için AI_PROVIDER=mock (veya boş) ayarlayabilirsiniz."
      )
    }
    const model = process.env.AI_MODEL || "gpt-4o-mini"
    _provider = new OpenAiAdvisorProvider(apiKey, model)
    return _provider
  }

  if (providerName === "deepseek") {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      throw new Error(
        "DeepSeek ile servis danışmanı için DEEPSEEK_API_KEY tanımlanmalıdır. " +
          "Demo verisi kullanmak için AI_PROVIDER=mock (veya boş) ayarlayabilirsiniz."
      )
    }
    const model = process.env.AI_MODEL || "deepseek-chat"
    _provider = new DeepSeekAdvisorProvider(apiKey, model)
    return _provider
  }

  throw new Error(
    `Bilinmeyen AI sağlayıcısı: "${providerName}". Desteklenen değerler: mock (varsayılan), openai, deepseek.`
  )
}

export function resetAdvisorProvider(): void {
  _provider = null
}