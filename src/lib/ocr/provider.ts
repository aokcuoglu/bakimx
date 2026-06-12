import type { OcrProvider, OcrProviderName } from "./types"
import { getMockOcrProvider } from "./mock-ocr-provider"
import { OpenAiOcrProvider } from "./openai-ocr-provider"
import { DeepSeekOcrProvider } from "./deepseek-ocr-provider"
import { TesseractOcrProvider } from "./tesseract-ocr-provider"

let _provider: OcrProvider | null = null

function parseProviderName(value: string | undefined): OcrProviderName {
  const normalized = (value || "").toLowerCase().trim()
  if (!normalized || normalized === "mock") return "mock"
  if (normalized === "deepseek") return "deepseek"
  if (normalized === "openai") return "openai"
  if (normalized === "tesseract") return "tesseract"
  throw new Error(
    `Bilinmeyen OCR sağlayıcısı: "${value}". Desteklenen değerler: mock (varsayılan), deepseek, openai, tesseract. ` +
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

  if (providerName === "deepseek") {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      throw new Error(
        "DeepSeek ile ruhsat okuma için DEEPSEEK_API_KEY tanımlanmalıdır. " +
          "Demo verisi kullanmak için OCR_PROVIDER=mock (veya boş) ayarlayabilirsiniz."
      )
    }
    const model = process.env.OCR_MODEL || process.env.DEEPSEEK_OCR_MODEL
    if (!model) {
      throw new Error(
        "DeepSeek ile ruhsat okuma için OCR_MODEL veya DEEPSEEK_OCR_MODEL tanımlanmalıdır (ör: deepseek-chat). " +
          "Demo verisi kullanmak için OCR_PROVIDER=mock (veya boş) ayarlayabilirsiniz."
      )
    }
    _provider = new DeepSeekOcrProvider(apiKey, model)
    return _provider
  }

  if (providerName === "tesseract") {
    _provider = new TesseractOcrProvider()
    return _provider
  }

  throw new Error(
    `Bilinmeyen OCR sağlayıcısı: "${providerName}". Desteklenen değerler: mock (varsayılan), deepseek, openai, tesseract.`
  )
}

export function resetOcrProvider(): void {
  _provider = null
}