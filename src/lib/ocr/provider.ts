import type { OcrProvider, OcrProviderName } from "./types"
import { getMockOcrProvider } from "./mock-ocr-provider"
import { OpenAiOcrProvider } from "./openai-ocr-provider"
import { AnthropicOcrProvider } from "./anthropic-ocr-provider"

let _provider: OcrProvider | null = null

function parseProviderName(value: string | undefined): OcrProviderName {
  const normalized = (value || "").toLowerCase().trim()
  if (!normalized || normalized === "mock") return "mock"
  if (normalized === "anthropic") return "anthropic"
  if (normalized === "openai") return "openai"
  throw new Error(
    `Bilinmeyen OCR sağlayıcısı: "${value}". Desteklenen değerler: mock (varsayılan), anthropic, openai. ` +
      "OCR_PROVIDER ortam değişkenini kontrol ediniz."
  )
}

export async function getOcrProvider(): Promise<OcrProvider> {
  if (_provider) return _provider

  const providerName = parseProviderName(process.env.OCR_PROVIDER)

  if (providerName === "mock") {
    _provider = getMockOcrProvider()
    return _provider
  }

  if (providerName === "openai") {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error(
        "OpenAI ile ruhsat okuma için OPENAI_API_KEY tanımlanmalıdır. " +
          "Demo verisi kullanmak için OCR_PROVIDER=mock (veya boş) ayarlayabilirsiniz."
      )
    }
    const model = process.env.OCR_MODEL || process.env.OPENAI_OCR_MODEL
    if (!model) {
      throw new Error(
        "OpenAI ile ruhsat okuma için OCR_MODEL veya OPENAI_OCR_MODEL tanımlanmalıdır (ör: gpt-4o, gpt-4o-mini). " +
          "Demo verisi kullanmak için OCR_PROVIDER=mock (veya boş) ayarlayabilirsiniz."
      )
    }
    _provider = new OpenAiOcrProvider(apiKey, model)
    return _provider
  }

  if (providerName === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error(
        "Claude ile ruhsat okuma için ANTHROPIC_API_KEY tanımlanmalıdır. " +
          "Demo verisi kullanmak için OCR_PROVIDER=mock (veya boş) ayarlayabilirsiniz."
      )
    }
    // Vision destekli bir Claude modeli. Varsayılan: hızlı/ucuz Haiku 4.5.
    const model = process.env.OCR_MODEL || "claude-haiku-4-5"
    _provider = new AnthropicOcrProvider(apiKey, model)
    return _provider
  }

  throw new Error(
    `Bilinmeyen OCR sağlayıcısı: "${providerName}". Desteklenen değerler: mock (varsayılan), anthropic, openai.`
  )
}

export function resetOcrProvider(): void {
  _provider = null
}