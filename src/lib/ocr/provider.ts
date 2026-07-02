import type { OcrProvider, OcrProviderName } from "./types"
import { getMockOcrProvider } from "./mock-ocr-provider"
import { OpenAiOcrProvider } from "./openai-ocr-provider"
import { PaddleOcrProvider } from "./paddle-ocr-provider"
import { HybridOcrProvider } from "./hybrid-ocr-provider"
// Claude Vision (Anthropic) — artık HİBRİT sağlayıcının fallback'i olarak kullanılıyor
// (PaddleOCR birincil, zayıf/soluk alanlar için Claude). Standalone "anthropic" dalı
// hâlâ yorumda ama class hibritte aktif.
import { AnthropicOcrProvider } from "./anthropic-ocr-provider"

let _provider: OcrProvider | null = null

function parseProviderName(value: string | undefined): OcrProviderName {
  const normalized = (value || "").toLowerCase().trim()
  if (!normalized || normalized === "mock") return "mock"
  if (normalized === "paddle") return "paddle"
  if (normalized === "hybrid") return "hybrid"
  if (normalized === "openai") return "openai"
  // Claude Vision standalone — DEVRE DIŞI (hibritte fallback olarak kullanılıyor). Tek başına
  // Claude için bu satırı ve aşağıdaki dalı yorumdan çıkar.
  // if (normalized === "anthropic") return "anthropic"
  throw new Error(
    `Bilinmeyen OCR sağlayıcısı: "${value}". Desteklenen değerler: mock (varsayılan), paddle, hybrid, openai. ` +
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

  if (providerName === "paddle") {
    // OCR Python sidecar'ında (ocr-service/, paddlepaddle+paddleocr) çalışır.
    const serviceUrl = process.env.OCR_SERVICE_URL || "http://127.0.0.1:8000"
    const timeoutMs = Number(process.env.OCR_SERVICE_TIMEOUT_MS) || 60_000
    _provider = new PaddleOcrProvider(serviceUrl, timeoutMs)
    return _provider
  }

  if (providerName === "hybrid") {
    // PaddleOCR birincil (sidecar) + Claude Vision fallback (zayıf/soluk alanlar için).
    const serviceUrl = process.env.OCR_SERVICE_URL || "http://127.0.0.1:8000"
    const timeoutMs = Number(process.env.OCR_SERVICE_TIMEOUT_MS) || 60_000
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error(
        "Hibrit OCR (PaddleOCR + Claude fallback) için ANTHROPIC_API_KEY tanımlanmalıdır. " +
          "Yalnız PaddleOCR için OCR_PROVIDER=paddle, demo için mock kullanabilirsiniz."
      )
    }
    const model = process.env.OCR_MODEL || "claude-haiku-4-5"
    // Bu güvenin altındaki alanlar Claude'a devredilir (varsayılan 0.85; paddle temiz
    // metinde 0.9+, kısmi/soluk okumalar ~0.7 → fallback tetiklenir). OCR_HYBRID_MIN_CONFIDENCE ile ayarla.
    const minConfidence = Number(process.env.OCR_HYBRID_MIN_CONFIDENCE) || 0.85
    const paddle = new PaddleOcrProvider(serviceUrl, timeoutMs)
    const anthropic = new AnthropicOcrProvider(apiKey, model)
    _provider = new HybridOcrProvider(paddle, anthropic, minConfidence)
    return _provider
  }

  // Claude Vision (Anthropic) — DEVRE DIŞI. PaddleOCR'dan vazgeçilirse bu bloğu ve
  // yukarıdaki import + parseProviderName satırını geri açman yeterli.
  // if (providerName === "anthropic") {
  //   const apiKey = process.env.ANTHROPIC_API_KEY
  //   if (!apiKey) {
  //     throw new Error(
  //       "Claude ile ruhsat okuma için ANTHROPIC_API_KEY tanımlanmalıdır. " +
  //         "Demo verisi kullanmak için OCR_PROVIDER=mock (veya boş) ayarlayabilirsiniz."
  //     )
  //   }
  //   // Vision destekli bir Claude modeli. Varsayılan: hızlı/ucuz Haiku 4.5.
  //   const model = process.env.OCR_MODEL || "claude-haiku-4-5"
  //   _provider = new AnthropicOcrProvider(apiKey, model)
  //   return _provider
  // }

  throw new Error(
    `Bilinmeyen OCR sağlayıcısı: "${providerName}". Desteklenen değerler: mock (varsayılan), paddle, hybrid, openai.`
  )
}

export function resetOcrProvider(): void {
  _provider = null
}