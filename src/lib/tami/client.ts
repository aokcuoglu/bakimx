import type { TamiConfig } from "./config"
import { TAMI_ERROR_MESSAGES, TamiError, sanitizeForLog } from "./errors"
import { buildAuthToken, signSecurityHash } from "./hash"
import type {
  TamiAuth3dsResponse,
  TamiCancelInput,
  TamiClient,
  TamiComplete3dsResponse,
  TamiPaymentBody,
  TamiQueryInput,
  TamiQueryResponse,
  TamiRefundInput,
  TamiReverseResponse,
} from "./types"

const REQUEST_TIMEOUT_MS = 30_000

interface TamiApiErrorShape {
  success?: boolean
  errorCode?: string
  errorMessage?: string
  correlationId?: string
}

async function postJson<TResp>(path: string, body: Record<string, unknown>, cfg: TamiConfig): Promise<TResp> {
  const correlationId = crypto.randomUUID()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(`${cfg.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PG-Auth-Token": buildAuthToken(cfg),
        "PG-Api-Version": "v3",
        CorrelationId: correlationId,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    let json: (TResp & TamiApiErrorShape) | undefined
    try {
      json = await res.json()
    } catch {
      throw new TamiError({
        code: "INVALID_RESPONSE",
        message: "TAMI yanıtı JSON olarak ayrıştırılamadı",
        correlationId,
      })
    }

    if (!res.ok || json?.success === false || json?.errorCode) {
      // TAMI errorCode'u JSON SAYI dönebiliyor (ör. 148); Prisma String? kolonuna güvenli
      // yazım için burada string'e normalize edilir (0 dahil — `|| status` sıfırı düşürürdü).
      const code = json?.errorCode != null ? String(json.errorCode) : String(res.status)
      throw new TamiError({
        code,
        message: json?.errorMessage || `TAMI isteği başarısız oldu (HTTP ${res.status})`,
        correlationId: json?.correlationId || correlationId,
      })
    }

    return json as TResp
  } catch (err) {
    if (err instanceof TamiError) throw err

    const isAbort = err instanceof Error && err.name === "AbortError"
    console.error("[tami] istek başarısız", {
      path,
      correlationId,
      isTimeout: isAbort,
      body: sanitizeForLog(body),
      error: err instanceof Error ? err.message : String(err),
    })

    throw new TamiError({
      code: isAbort ? "TIMEOUT" : "NETWORK_ERROR",
      message: isAbort ? "TAMI isteği zaman aşımına uğradı" : err instanceof Error ? err.message : "Bilinmeyen ağ hatası",
      correlationId,
      userMessage: TAMI_ERROR_MESSAGES.default,
    })
  } finally {
    clearTimeout(timeout)
  }
}

/** Gerçek TAMI sanal POS istemcisi — sandbox/production ortak fetch wrapper'ı. */
export function createTamiClient(cfg: TamiConfig): TamiClient {
  return {
    async auth3ds(input: TamiPaymentBody): Promise<TamiAuth3dsResponse> {
      // Gövde tam olarak buildTamiPaymentBody'den gelir — alan-alan varsayılan
      // kurulumu artık burada YAPILMAZ (tek doğruluk kaynağı request-builder.ts).
      const securityHash = await signSecurityHash(input, cfg)
      return postJson<TamiAuth3dsResponse>("/payment/auth", { ...input, securityHash }, cfg)
    },

    async preAuth3ds(input: TamiPaymentBody): Promise<TamiAuth3dsResponse> {
      // Kart doğrulama ön provizyonu — gövde auth3ds ile aynı (buildTamiPaymentBody),
      // yalnız endpoint farklı: /payment/pre-auth (canlı sandbox'ta doğrulandı).
      const securityHash = await signSecurityHash(input, cfg)
      return postJson<TamiAuth3dsResponse>("/payment/pre-auth", { ...input, securityHash }, cfg)
    },

    async complete3ds(orderId: string): Promise<TamiComplete3dsResponse> {
      const body = { orderId }
      const securityHash = await signSecurityHash(body, cfg)
      return postJson<TamiComplete3dsResponse>("/payment/complete-3ds", { ...body, securityHash }, cfg)
    },

    async cancel(input: TamiCancelInput): Promise<TamiReverseResponse> {
      const body = { orderId: input.orderId, reason: input.reason }
      const securityHash = await signSecurityHash(body, cfg)
      return postJson<TamiReverseResponse>("/payment/reverse", { ...body, securityHash }, cfg)
    },

    async refund(input: TamiRefundInput): Promise<TamiReverseResponse> {
      const body = { orderId: input.orderId, amount: input.amount, reason: input.reason }
      const securityHash = await signSecurityHash(body, cfg)
      return postJson<TamiReverseResponse>("/payment/reverse", { ...body, securityHash }, cfg)
    },

    async queryTransaction(input: TamiQueryInput): Promise<TamiQueryResponse> {
      const body = { orderId: input.orderId, isTransactionDetail: input.isTransactionDetail }
      const securityHash = await signSecurityHash(body, cfg)
      return postJson<TamiQueryResponse>("/payment/query", { ...body, securityHash }, cfg)
    },
  }
}
