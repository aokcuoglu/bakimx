import { getTamiConfig, isTamiConfigured } from "./config"
import { createTamiClient } from "./client"
import { createMockTamiClient } from "./mock"
import type { TamiClient } from "./types"

let _instance: TamiClient | null = null

/** isTamiConfigured() false ise mock istemci (varsayılan), doluysa gerçek TAMI istemcisi. */
export function getTamiClient(): TamiClient {
  if (_instance) return _instance

  const cfg = getTamiConfig()
  _instance = isTamiConfigured(cfg) ? createTamiClient(cfg) : createMockTamiClient()

  return _instance
}

export function resetTamiClient(): void {
  _instance = null
}

export type { TamiConfig } from "./config"
export { getTamiConfig, isTamiConfigured } from "./config"
export * from "./types"
export { TamiError, TAMI_ERROR_MESSAGES, sanitizeForLog } from "./errors"
export { buildAuthToken, computeCallbackHash, signSecurityHash, verifyCallbackHash } from "./hash"
