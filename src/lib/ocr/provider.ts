import type { OcrProvider, OcrProviderName } from "./types"
import { getMockOcrProvider } from "./mock-ocr-provider"
import { OpenAiOcrProvider } from "./openai-ocr-provider"
// Claude Vision (Anthropic) — MVP standardı: sidecar'sız, doğrudan görüntüden
// yapılandırılmış çıkarım (bkz. OCR_PROVIDER=anthropic dalı).
import { AnthropicOcrProvider } from "./anthropic-ocr-provider"

let _provider: OcrProvider | null = null

/**
 * 2026-07-05'te emekli edilen, PaddleOCR sidecar'ına (ocr-service/) bağımlı
 * değerler. Sidecar hiçbir ortama deploy edilmiyordu; bu değerlerden birine
 * ayarlı bir ortam kalmışsa "bilinmeyen değer" yerine ne yapılacağını söyleyen
 * bir hata alsın. Bu koruma, ortam değişkenlerinin doğrulanmasından sonra
 * kaldırılabilir (prod/dev OCR_PROVIDER'ı CDK task-def'inde, repo dışında).
 */
const RETIRED_PROVIDERS = new Set(["paddle", "hybrid"])

function parseProviderName(value: string | undefined): OcrProviderName {
  const normalized = (value || "").toLowerCase().trim()
  if (!normalized || normalized === "mock") return "mock"
  if (normalized === "openai") return "openai"
  if (normalized === "anthropic") return "anthropic"
  if (RETIRED_PROVIDERS.has(normalized)) {
    throw new Error(
      `OCR sağlayıcısı "${normalized}" emekli edildi: dayandığı PaddleOCR sidecar'ı (ocr-service/) kaldırıldı. ` +
        "OCR_PROVIDER=anthropic olarak güncelleyin (ANTHROPIC_API_KEY zorunlu), demo için mock kullanın."
    )
  }
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

  // Claude Vision (Anthropic) — sidecar'sız, doğrudan görüntüden yapılandırılmış çıkarım.
  if (providerName === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error(
        "Claude ile ruhsat okuma için ANTHROPIC_API_KEY tanımlanmalıdır. " +
          "Demo verisi kullanmak için OCR_PROVIDER=mock (veya boş) ayarlayabilirsiniz."
      )
    }
    // Vision destekli bir Claude modeli. Varsayılan: Sonnet 5 — ruhsatta sahip adı/
    // tarih gibi kritik alanları Haiku'dan belirgin daha doğru okur (MVP standardı).
    // Maliyet/hız için OCR_MODEL=claude-haiku-4-5 ile override edilebilir.
    const model = process.env.OCR_MODEL || "claude-sonnet-5"
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