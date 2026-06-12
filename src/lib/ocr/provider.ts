import type { OcrProvider } from "./types"
import { getMockOcrProvider } from "./mock-ocr-provider"
import { OpenAiOcrProvider } from "./openai-ocr-provider"
import { DeepSeekOcrProvider } from "./deepseek-ocr-provider"

let _provider: OcrProvider | null = null

export async function getOcrProvider(): Promise<OcrProvider> {
  if (_provider) return _provider

  const provider = process.env.OCR_PROVIDER || "deepseek"

  if (provider === "mock") {
    _provider = getMockOcrProvider()
    return _provider
  }

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error(
        "Gerçek ruhsat okuma için OPENAI_API_KEY tanımlanmalıdır. " +
          "Demo verisi kullanmak için OCR_PROVIDER=mock ayarlayabilirsiniz."
      )
    }
    _provider = new OpenAiOcrProvider(apiKey)
    return _provider
  }

  if (provider === "deepseek") {
    const apiKey = process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      throw new Error(
        "DeepSeek ile ruhsat okuma için DEEPSEEK_API_KEY tanımlanmalıdır. " +
          "Demo verisi kullanmak için OCR_PROVIDER=mock ayarlayabilirsiniz."
      )
    }
    _provider = new DeepSeekOcrProvider(apiKey)
    return _provider
  }

  throw new Error(
    `Bilinmeyen OCR sağlayıcısı: "${provider}". Desteklenen değerler: "deepseek", "openai", "mock". ` +
      "OCR_PROVIDER ortam değişkenini kontrol ediniz."
  )
}

export function resetOcrProvider(): void {
  _provider = null
}
