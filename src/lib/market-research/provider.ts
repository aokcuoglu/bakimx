import Anthropic from "@anthropic-ai/sdk"
import type { Message, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages"
import type {
  MarketResearchInput,
  MarketResearchProvider,
  MarketResearchResult,
  MarketResearchRunOptions,
  MarketResearchSource,
  MarketResearchSuggestion,
} from "./types"
import {
  MICRO_USD,
  failMarketResearchUsage,
  releaseMarketResearchBudget,
  reserveMarketResearchBudget,
  reserveMarketResearchUsage,
  settleMarketResearchBudget,
  settleMarketResearchUsage,
} from "./budget"

type EnvReader = (name: string) => string | undefined

export interface AnthropicMarketResearchConfig {
  apiKey: string
  model: string
  maxUses: number
  allowedDomains: string[]
  monthlyBudgetMicroUsd: number
  discoveryMode: boolean
}

export function parseAnthropicMarketResearchConfig(getEnv: EnvReader): AnthropicMarketResearchConfig | null {
  const apiKey = getEnv("ANTHROPIC_API_KEY")?.trim()
  if (!apiKey) return null

  const rawMaxUses = getEnv("MARKET_RESEARCH_MAX_USES")?.trim()
  const maxUses = rawMaxUses ? Number(rawMaxUses) : Number.NaN
  if (!Number.isInteger(maxUses) || maxUses < 1) {
    throw new Error("Anthropic piyasa araştırması MARKET_RESEARCH_MAX_USES onaylanmadan açılamaz.")
  }

  const allowedDomains = (getEnv("MARKET_RESEARCH_ALLOWED_DOMAINS") ?? "")
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean)
  const discoveryMode = getEnv("MARKET_RESEARCH_DISCOVERY_MODE")?.trim().toLowerCase() === "true"
  const appUrl = getEnv("APP_URL")?.trim()
  const discoveryHostAllowed = (() => {
    if (!appUrl) return false
    try {
      const url = new URL(appUrl)
      return url.origin === "https://app-dev.bakimx.com"
        || url.hostname === "localhost"
        || url.hostname === "127.0.0.1"
    } catch {
      return false
    }
  })()
  if (discoveryMode && !discoveryHostAllowed) {
    throw new Error("Piyasa araştırması domain keşif modu yalnız localhost veya app-dev ortamında açılabilir.")
  }
  if (allowedDomains.length === 0 && !discoveryMode) {
    throw new Error("Anthropic piyasa araştırması MARKET_RESEARCH_ALLOWED_DOMAINS onaylanmadan açılamaz.")
  }

  const configuredBudget = getEnv("MARKET_RESEARCH_MONTHLY_BUDGET_USD")?.trim()
  const monthlyBudgetUsd = configuredBudget
    ? Number(configuredBudget)
    : getEnv("NODE_ENV") === "production" ? 25 : 5
  if (!Number.isFinite(monthlyBudgetUsd) || monthlyBudgetUsd <= 0) {
    throw new Error("Anthropic piyasa araştırması aylık bütçe tavanı onaylanmadan açılamaz.")
  }

  return {
    apiKey,
    model: getEnv("MARKET_RESEARCH_MODEL")?.trim() || "claude-sonnet-5",
    maxUses,
    allowedDomains: [...new Set(allowedDomains)],
    monthlyBudgetMicroUsd: Math.floor(monthlyBudgetUsd * MICRO_USD),
    discoveryMode,
  }
}

function validHttpSource(value: unknown, accessedAt: string): MarketResearchSource | null {
  if (!value || typeof value !== "object") return null
  const source = value as Record<string, unknown>
  if (typeof source.url !== "string" || typeof source.title !== "string") return null
  try {
    const url = new URL(source.url)
    if (url.protocol !== "https:" && url.protocol !== "http:") return null
    return { url: url.toString(), title: source.title.trim(), accessedAt }
  } catch {
    return null
  }
}

export function parseSourcedSuggestions(text: string, accessedAt = new Date().toISOString()): MarketResearchSuggestion[] {
  let value: unknown
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)(?:```|$)/)?.[1] ?? text
  try {
    value = JSON.parse(fenced.trim())
  } catch {
    // Model yanıtı token sınırında sonraki ürünün ortasında kesilse bile önceki
    // eksiksiz nesneleri kaybetme. Yalnız dış JSON dizisinin tamamlanmış üst
    // seviye nesnelerini toplar; string içindeki süslü parantezleri saymaz.
    const objects: unknown[] = []
    let depth = 0
    let start = -1
    let inString = false
    let escaped = false
    for (let index = fenced.indexOf("[") + 1; index > 0 && index < fenced.length; index += 1) {
      const character = fenced[index]
      if (inString) {
        if (escaped) escaped = false
        else if (character === "\\") escaped = true
        else if (character === '"') inString = false
        continue
      }
      if (character === '"') inString = true
      else if (character === "{") {
        if (depth === 0) start = index
        depth += 1
      } else if (character === "}" && depth > 0) {
        depth -= 1
        if (depth === 0 && start >= 0) {
          try { objects.push(JSON.parse(fenced.slice(start, index + 1))) } catch { /* eksik nesneyi atla */ }
          start = -1
        }
      }
    }
    value = objects
  }
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const row = item as Record<string, unknown>
    if (typeof row.name !== "string" || !Array.isArray(row.sources)) return []
    const sources = row.sources.map((source) => validHttpSource(source, accessedAt)).filter((source): source is MarketResearchSource => source !== null)
    if (sources.length === 0) return []
    return [{
      name: row.name.trim(),
      brand: typeof row.brand === "string" ? row.brand.trim() : null,
      partNumber: typeof row.partNumber === "string" ? row.partNumber.trim() : null,
      priceText: typeof row.priceText === "string" ? row.priceText.trim() : null,
      notes: typeof row.notes === "string" ? row.notes.trim() : null,
      sources,
    }]
  })
}

class MockMarketResearchProvider implements MarketResearchProvider {
  readonly name = "mock" as const
  async research(): Promise<MarketResearchResult> {
    return { provider: this.name, suggestions: [] }
  }
}

export class AnthropicMarketResearchProvider implements MarketResearchProvider {
  readonly name = "anthropic" as const
  private readonly client: Anthropic

  constructor(private readonly config: AnthropicMarketResearchConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey })
  }

  async research(input: MarketResearchInput, options?: MarketResearchRunOptions): Promise<MarketResearchResult> {
    const startedAt = Date.now()
    const reservation = options?.workshop
      ? await reserveMarketResearchUsage({
          ...options.workshop,
          platformLimitMicroUsd: this.config.monthlyBudgetMicroUsd,
        })
      : { monthStart: await reserveMarketResearchBudget(this.config.monthlyBudgetMicroUsd, new Date(), options?.maxMonthlyRequests) }
    const webSearchTool = {
      // Piyasa araştırması kısa ve kontrollü bir arama. Dinamik filtreli
      // 20260209 sürümü içeride code_execution ile 4+ sorgu üretip yerelde
      // 78-120 sn sürüyordu. Doğrudan GA araç aynı kaynak/citation sözleşmesini
      // daha düşük gecikmeyle verir ve max_uses sınırına birebir uyar.
      type: "web_search_20250305" as const,
      name: "web_search" as const,
      max_uses: this.config.maxUses,
      ...(this.config.discoveryMode ? {} : { allowed_domains: this.config.allowedDomains }),
    }
    const request: MessageCreateParamsNonStreaming = {
      model: this.config.model,
      max_tokens: 1800,
      system: "Yalnız izin verilen web kaynaklarında otomotiv parçası araştır. En fazla 3 ürün içeren eksiksiz bir JSON dizi döndür: name, brand, partNumber, priceText, notes, sources (url,title; ürün başına en fazla 2 kaynak). JSON dışında açıklama yazma. Kaynağı olmayan ürünü dahil etme. Sipariş verme veya kesin uyumluluk iddiasında bulunma.",
      messages: [{ role: "user", content: JSON.stringify(input) }],
      tools: [webSearchTool],
    }
    let response: Message
    try {
      response = await this.client.messages.create(request, { signal: AbortSignal.timeout(120_000) })
    } catch (error) {
      const release = options?.workshop && "usageId" in reservation
        ? failMarketResearchUsage(
            reservation,
            options.workshop.fundingSource,
            error instanceof Error ? error.name || "provider_error" : "provider_error",
            Date.now() - startedAt,
          )
        : releaseMarketResearchBudget(reservation.monthStart)
      await release.catch((releaseError) => {
        console.error("[market-research-budget-release]", releaseError)
      })
      throw error
    }
    const costMicroUsd = options?.workshop && "usageId" in reservation
      ? await settleMarketResearchUsage(reservation, options.workshop.fundingSource, response.usage, Date.now() - startedAt)
      : await settleMarketResearchBudget(reservation.monthStart, response.usage)
    const text = response.content.filter((block) => block.type === "text").map((block) => block.text).join("\n")
    return {
      provider: this.name,
      suggestions: parseSourcedSuggestions(text),
      usage: { costMicroUsd, webSearches: response.usage.server_tool_use?.web_search_requests ?? 0 },
    }
  }
}

let cached: MarketResearchProvider | null = null

export function getMarketResearchProvider(
  getEnv: EnvReader = (name) => process.env[name],
  apiKeyOverride?: string,
): MarketResearchProvider {
  if (!apiKeyOverride && cached) return cached
  const name = apiKeyOverride ? "anthropic" : (getEnv("MARKET_RESEARCH_PROVIDER") ?? "mock").trim().toLowerCase()
  if (!name || name === "mock") return (cached = new MockMarketResearchProvider())
  if (name !== "anthropic") throw new Error(`Bilinmeyen piyasa araştırması sağlayıcısı: "${name}".`)
  const effectiveEnv: EnvReader = apiKeyOverride
    ? (key) => key === "ANTHROPIC_API_KEY" ? apiKeyOverride : getEnv(key)
    : getEnv
  const config = parseAnthropicMarketResearchConfig(effectiveEnv)
  if (!config) return cached = new MockMarketResearchProvider()
  const provider = new AnthropicMarketResearchProvider(config)
  return apiKeyOverride ? provider : (cached = provider)
}

export function resetMarketResearchProvider(): void {
  cached = null
}
