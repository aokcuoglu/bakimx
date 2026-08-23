import Anthropic from "@anthropic-ai/sdk"
import type { Message, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages"
import type {
  MarketResearchInput,
  MarketResearchProvider,
  MarketResearchResult,
  MarketResearchSource,
  MarketResearchSuggestion,
} from "./types"
import { MICRO_USD, reserveMarketResearchBudget, settleMarketResearchBudget } from "./budget"

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
  if (discoveryMode && appUrl !== "https://app-dev.bakimx.com") {
    throw new Error("Piyasa araştırması domain keşif modu yalnız app-dev ortamında açılabilir.")
  }
  if (allowedDomains.length === 0 && !discoveryMode) {
    throw new Error("Anthropic piyasa araştırması MARKET_RESEARCH_ALLOWED_DOMAINS onaylanmadan açılamaz.")
  }

  const monthlyBudgetUsd = Number(getEnv("MARKET_RESEARCH_MONTHLY_BUDGET_USD")?.trim())
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
  try {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? text
    value = JSON.parse(fenced.trim())
  } catch {
    return []
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

class AnthropicMarketResearchProvider implements MarketResearchProvider {
  readonly name = "anthropic" as const
  private readonly client: Anthropic

  constructor(private readonly config: AnthropicMarketResearchConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey })
  }

  async research(input: MarketResearchInput, options?: { maxMonthlyRequests?: number }): Promise<MarketResearchResult> {
    const monthStart = await reserveMarketResearchBudget(
      this.config.monthlyBudgetMicroUsd,
      new Date(),
      options?.maxMonthlyRequests,
    )
    const webSearchTool = {
      type: "web_search_20260209" as const,
      name: "web_search" as const,
      max_uses: this.config.maxUses,
      ...(this.config.discoveryMode ? {} : { allowed_domains: this.config.allowedDomains }),
    }
    const request: MessageCreateParamsNonStreaming = {
      model: this.config.model,
      max_tokens: 1800,
      system: "Yalnız izin verilen web kaynaklarında otomotiv parçası araştır. JSON dizi döndür: name, brand, partNumber, priceText, notes, sources (url,title). Kaynağı olmayan ürünü dahil etme. Sipariş verme veya kesin uyumluluk iddiasında bulunma.",
      messages: [{ role: "user", content: JSON.stringify(input) }],
      tools: [webSearchTool],
    }
    const response: Message = await this.client.messages.create(request)
    const costMicroUsd = await settleMarketResearchBudget(monthStart, response.usage)
    const text = response.content.filter((block) => block.type === "text").map((block) => block.text).join("\n")
    return {
      provider: this.name,
      suggestions: parseSourcedSuggestions(text),
      usage: { costMicroUsd, webSearches: response.usage.server_tool_use?.web_search_requests ?? 0 },
    }
  }
}

let cached: MarketResearchProvider | null = null

export function getMarketResearchProvider(getEnv: EnvReader = (name) => process.env[name]): MarketResearchProvider {
  if (cached) return cached
  const name = (getEnv("MARKET_RESEARCH_PROVIDER") ?? "mock").trim().toLowerCase()
  if (!name || name === "mock") return (cached = new MockMarketResearchProvider())
  if (name !== "anthropic") throw new Error(`Bilinmeyen piyasa araştırması sağlayıcısı: "${name}".`)
  const config = parseAnthropicMarketResearchConfig(getEnv)
  return (cached = config ? new AnthropicMarketResearchProvider(config) : new MockMarketResearchProvider())
}

export function resetMarketResearchProvider(): void {
  cached = null
}
