import { requireToken } from "./core"

export type ActorRun = {
  id: string
  status: string
  defaultDatasetId: string | null
  usageTotalUsd: number | null
}

type ApiEnvelope = { data?: unknown }
type Fetcher = typeof fetch

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Apify API returned malformed data.")
  return value as Record<string, unknown>
}

function runFrom(value: unknown): ActorRun {
  const run = asRecord(value)
  if (typeof run.id !== "string" || typeof run.status !== "string") throw new Error("Apify run response is malformed.")
  return {
    id: run.id,
    status: run.status,
    defaultDatasetId: typeof run.defaultDatasetId === "string" ? run.defaultDatasetId : null,
    usageTotalUsd: typeof run.usageTotalUsd === "number" && Number.isFinite(run.usageTotalUsd) ? run.usageTotalUsd : null,
  }
}

export function createApifyApi(token: string | undefined, fetcher: Fetcher = fetch) {
  const safeToken = requireToken(token)
  async function request(path: string, init: RequestInit = {}): Promise<unknown> {
    const response = await fetcher(`https://api.apify.com/v2${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${safeToken}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
    })
    // Do not print response bodies; they may echo input or account details.
    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { error?: { type?: unknown } } | null
      const errorType = typeof payload?.error?.type === "string" && /^[a-z0-9-]+$/.test(payload.error.type) ? payload.error.type : "unknown"
      throw new Error(`Apify API request failed (${response.status}, ${errorType}) at ${path.split("?")[0]}.`)
    }
    return response.json()
  }
  return {
    async monthlyUsage(): Promise<number> {
      const response = asRecord((await request("/users/me/usage/monthly") as ApiEnvelope).data)
      const usage = response.totalUsageCreditsUsdAfterVolumeDiscount
      if (typeof usage !== "number" || !Number.isFinite(usage) || usage < 0) {
        throw new Error("Apify monthly usage is unavailable or malformed. No scraping executed.")
      }
      return usage
    },
    async startRun(input: object, maxTotalChargeUsd: number): Promise<ActorRun> {
      if (!(maxTotalChargeUsd > 0 && maxTotalChargeUsd <= 0.12)) throw new Error("Unsafe Actor run charge cap.")
      const query = new URLSearchParams({ maxTotalChargeUsd: maxTotalChargeUsd.toFixed(5), restartOnError: "false", timeout: "120", waitForFinish: "60" })
      const response = await request(`/actors/apify~website-content-crawler/runs?${query}`, { method: "POST", body: JSON.stringify(input) }) as ApiEnvelope
      return runFrom(response.data)
    },
    async getRun(id: string): Promise<ActorRun> {
      const response = await request(`/actor-runs/${encodeURIComponent(id)}`) as ApiEnvelope
      return runFrom(response.data)
    },
    async datasetItems(id: string): Promise<unknown> {
      return request(`/datasets/${encodeURIComponent(id)}/items?format=json&clean=true&limit=8`)
    },
  }
}

export type ApifyApi = ReturnType<typeof createApifyApi>
