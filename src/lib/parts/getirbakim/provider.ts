import { getMockGetirbakimProvider } from "./mock-getirbakim-provider"
import {
  GETIRBAKIM_DEFAULT_TIMEOUT_MS,
  HttpGetirbakimProvider,
} from "./http-getirbakim-provider"
import type { GetirbakimProvider, GetirbakimProviderName } from "./types"

/**
 * GetirBakım sağlayıcı seçimi (BAK-183) — OCR/AI sağlayıcı deseninin kardeşi
 * (`src/lib/ocr/provider.ts`, `src/lib/advisor/provider.ts`).
 *
 * Mock sağlayıcı yalnız development/test içindir. Production'da eksik veya
 * hatalı yapılandırma demo fiyat göstermemeli; fail-closed davranır.
 */

let _provider: GetirbakimProvider | null = null
let _missingKeyWarned = false

export function parseGetirbakimProviderName(
  value: string | undefined,
): GetirbakimProviderName {
  const normalized = (value || "").toLowerCase().trim()
  if (!normalized || normalized === "mock") return "mock"
  if (normalized === "http") return "http"
  throw new Error(
    `Bilinmeyen GetirBakım sağlayıcısı: "${value}". Desteklenen değerler: mock (varsayılan), http. ` +
      "GETIRBAKIM_PROVIDER ortam değişkenini kontrol ediniz.",
  )
}

function parseTimeoutMs(value: string | undefined): number {
  const parsed = Number((value || "").trim())
  if (!Number.isFinite(parsed) || parsed < 500) return GETIRBAKIM_DEFAULT_TIMEOUT_MS
  return Math.min(Math.floor(parsed), 15_000)
}

export function getGetirbakimProvider(): GetirbakimProvider {
  if (_provider) return _provider

  const providerName = parseGetirbakimProviderName(process.env.GETIRBAKIM_PROVIDER)

  if (process.env.NODE_ENV === "production" && providerName === "mock") {
    throw new Error("GETIRBAKIM_PROVIDER production ortamında http olmalıdır.")
  }

  if (providerName === "http") {
    const apiKey = process.env.GETIRBAKIM_API_KEY?.trim()
    const baseUrl = process.env.GETIRBAKIM_API_URL?.trim()

    if (apiKey && baseUrl) {
      _provider = new HttpGetirbakimProvider(
        baseUrl,
        apiKey,
        parseTimeoutMs(process.env.GETIRBAKIM_TIMEOUT_MS),
      )
      return _provider
    }

    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `GetirBakım production yapılandırması eksik: ${!apiKey ? "GETIRBAKIM_API_KEY" : "GETIRBAKIM_API_URL"}.`,
      )
    }

    if (!_missingKeyWarned) {
      _missingKeyWarned = true
      console.warn(
        "[getirbakim] GETIRBAKIM_PROVIDER=http ama " +
          `${!apiKey ? "GETIRBAKIM_API_KEY" : "GETIRBAKIM_API_URL"} tanımlı değil — demo (mock) veriye düşülüyor. ` +
          "Dış çağrı YAPILMAYACAK.",
      )
    }
  }

  _provider = getMockGetirbakimProvider()
  return _provider
}

/** Yalnız test içindir — seçilen sağlayıcıyı ve uyarı belleğini sıfırlar. */
export function resetGetirbakimProvider(): void {
  _provider = null
  _missingKeyWarned = false
}
