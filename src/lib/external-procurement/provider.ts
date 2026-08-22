import { GetirBakimClient } from "./getirbakim-client"
import { MockProcurementClient } from "./mock-client"
import type { ProcurementProviderClient } from "./types"

let provider: ProcurementProviderClient | null = null

interface ProcurementProviderEnv {
  NODE_ENV?: string
  GETIRBAKIM_PROVIDER?: string
  GETIRBAKIM_API_URL?: string
  GETIRBAKIM_API_KEY?: string
}

type ProcurementProviderConfig =
  | { name: "mock" }
  | { name: "http"; baseUrl: string; apiKey: string }

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

export function resolveProcurementProviderConfig(
  env: ProcurementProviderEnv,
): ProcurementProviderConfig {
  const providerName = env.GETIRBAKIM_PROVIDER?.trim().toLowerCase()
  const baseUrl = env.GETIRBAKIM_API_URL?.trim()
  const apiKey = env.GETIRBAKIM_API_KEY?.trim()

  if (env.NODE_ENV === "production" && providerName !== "http") {
    throw new Error("GetirBakim procurement provider must be configured as http in production")
  }

  if (providerName === "http") {
    if (!baseUrl || !apiKey || !isHttpUrl(baseUrl)) {
      throw new Error("GetirBakim procurement provider configuration is unavailable")
    }
    return { name: "http", baseUrl, apiKey }
  }

  return { name: "mock" }
}

export function getProcurementProvider(): ProcurementProviderClient {
  if (provider) return provider
  const config = resolveProcurementProviderConfig(process.env)
  provider = config.name === "http"
    ? new GetirBakimClient(config.baseUrl, config.apiKey)
    : new MockProcurementClient()
  return provider
}
