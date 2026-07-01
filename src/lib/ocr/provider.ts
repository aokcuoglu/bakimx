import type { OcrProvider, OcrProviderName } from "./types"
import { getMockOcrProvider } from "./mock-ocr-provider"
import { OpenAiOcrProvider } from "./openai-ocr-provider"
import { PaddleOcrProvider } from "./paddle-ocr-provider"
// Claude Vision (Anthropic) OCR — PaddleOCR'a geçildiği için DEVRE DIŞI. Silinmedi;
// PaddleOCR'dan vazgeçilirse aşağıdaki dalla birlikte bu import geri açılır.
// import { AnthropicOcrProvider } from "./anthropic-ocr-provider"

let _provider: OcrProvider | null = null

function parseProviderName(value: string | undefined): OcrProviderName {
  const normalized = (value || "").toLowerCase().trim()
  if (!normalized || normalized === "mock") return "mock"
  if (normalized === "paddle") return "paddle"
  if (normalized === "openai") return "openai"
  // Claude Vision — DEVRE DIŞI (PaddleOCR aktif). Geri açmak için bu satırı yorumdan çıkar.
  // if (normalized === "anthropic") return "anthropic"
  throw new Error(
    `Bilinmeyen OCR sağlayıcısı: "${value}". Desteklenen değerler: mock (varsayılan), paddle, openai. ` +
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
    `Bilinmeyen OCR sağlayıcısı: "${providerName}". Desteklenen değerler: mock (varsayılan), paddle, openai.`
  )
}

export function resetOcrProvider(): void {
  _provider = null
}