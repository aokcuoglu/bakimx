export type MarketResearchProviderName = "mock" | "anthropic"

export interface MarketResearchInput {
  query: string
  vehicle?: string | null
  partNumbers?: string[]
}

export interface MarketResearchSource {
  url: string
  title: string
  accessedAt: string
}

export interface MarketResearchSuggestion {
  name: string
  brand: string | null
  partNumber: string | null
  priceText: string | null
  notes: string | null
  sources: MarketResearchSource[]
}

export interface MarketResearchResult {
  provider: MarketResearchProviderName
  suggestions: MarketResearchSuggestion[]
  usage?: { costMicroUsd: number; webSearches: number }
}

export interface MarketResearchRunOptions {
  maxMonthlyRequests?: number
  workshop?: {
    workshopId: string
    userId: string
    fundingSource: "platform" | "customer"
  }
}

export interface MarketResearchProvider {
  readonly name: MarketResearchProviderName
  research(input: MarketResearchInput, options?: MarketResearchRunOptions): Promise<MarketResearchResult>
}
