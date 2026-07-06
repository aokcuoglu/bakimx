import type { TamiEnvName } from "./types"

const SANDBOX_BASE_URL = "https://sandbox-paymentapi.tami.com.tr"
const PRODUCTION_BASE_URL = "https://paymentapi.tami.com.tr"

export interface TamiConfig {
  env: TamiEnvName
  baseUrl: string
  merchantNumber: string
  terminalNumber: string
  secretKey: string
  jwkKid: string
  jwkKey: string
}

/** Env'den TAMI yapılandırmasını okur. TAMI_ENV dışında hiçbir alan zorunlu değildir —
 *  eksik kimlik bilgileri `isTamiConfigured` ile fark edilir, factory (index.ts) mock'a düşer. */
export function getTamiConfig(): TamiConfig {
  const env: TamiEnvName = process.env.TAMI_ENV === "production" ? "production" : "sandbox"

  return {
    env,
    baseUrl: env === "production" ? PRODUCTION_BASE_URL : SANDBOX_BASE_URL,
    merchantNumber: process.env.TAMI_MERCHANT_NUMBER || "",
    terminalNumber: process.env.TAMI_TERMINAL_NUMBER || "",
    secretKey: process.env.TAMI_SECRET_KEY || "",
    jwkKid: process.env.TAMI_JWK_KID || "",
    jwkKey: process.env.TAMI_JWK_KEY || "",
  }
}

/** Beş kimlik alanı da doluysa true — bu durumda factory gerçek istemciyi döndürür. */
export function isTamiConfigured(cfg: TamiConfig = getTamiConfig()): boolean {
  return Boolean(cfg.merchantNumber && cfg.terminalNumber && cfg.secretKey && cfg.jwkKid && cfg.jwkKey)
}
