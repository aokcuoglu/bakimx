import { GetirBakimClient } from "./getirbakim-client"
import { MockProcurementClient } from "./mock-client"
import type { ProcurementProviderClient } from "./types"

let provider: ProcurementProviderClient | null = null

export function getProcurementProvider(): ProcurementProviderClient {
  if (provider) return provider
  const baseUrl = process.env.GETIRBAKIM_API_URL?.trim()
  const apiKey = process.env.GETIRBAKIM_API_KEY?.trim()
  if (process.env.GETIRBAKIM_PROVIDER === "http") {
    if (!baseUrl || !apiKey) throw new Error("GetirBakim procurement provider configuration is unavailable")
    provider = new GetirBakimClient(baseUrl, apiKey)
    return provider
  }
  provider = new MockProcurementClient()
  return provider
}
