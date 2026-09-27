export const PHASE2_QUERIES = [
  "PADOK Hayat Yazılım oto servis",
  "ServisData oto servis",
  "Kursoft oto servis",
  "oto servis programı",
  "iş emri programı",
  "ruhsat okuma servis",
  "oto servis stok takip",
] as const

export type SearchResult = { position: number; title: string; url: string; description: string }
export type SearchPage = {
  query: string
  page: number
  searchUrl: string
  organicResults: SearchResult[]
  fetchedAt: string
  actorRunId: string
}

export function googleInput() {
  return {
    queries: PHASE2_QUERIES.join("\n"),
    maxPagesPerQuery: 1,
    countryCode: "tr",
    languageCode: "tr",
    searchLanguage: "tr",
    aiOverview: { scrapeFullAiOverview: false },
    aiModeSearch: { enableAiMode: false },
    websiteContentScraper: { enable: false },
    focusOnPaidAds: false,
    saveHtml: false,
    saveHtmlToKeyValueStore: false,
    includeIcons: false,
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function webUrl(value: unknown): string | null {
  if (typeof value !== "string") return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null
  } catch { return null }
}

export function normalizeSearchPage(item: unknown, actorRunId: string, fetchedAt: string): SearchPage | null {
  const source = record(item)
  const search = record(source?.searchQuery)
  const query = search?.term
  const page = search?.page
  if (typeof query !== "string" || !PHASE2_QUERIES.some((entry) => entry.toLowerCase() === query.trim().toLowerCase())) return null
  if (page !== 1 || !Array.isArray(source?.organicResults)) return null
  const searchUrl = webUrl(search?.url) ?? `https://www.google.com/search?q=${encodeURIComponent(query)}`
  const results: SearchResult[] = []
  for (const [index, value] of source.organicResults.entries()) {
    const result = record(value)
    const url = webUrl(result?.url)
    if (!url || typeof result?.title !== "string") continue
    results.push({ position: index + 1, title: result.title, url, description: typeof result.description === "string" ? result.description : "" })
    if (results.length === 10) break
  }
  return { query: query.trim(), page: 1, searchUrl, organicResults: results, fetchedAt, actorRunId }
}

export function normalizeSearchDataset(items: unknown, actorRunId: string, fetchedAt = new Date().toISOString()) {
  if (!Array.isArray(items)) throw new Error("Google Search dataset is malformed; expected an array.")
  const pages = items.map((item) => normalizeSearchPage(item, actorRunId, fetchedAt)).filter((page): page is SearchPage => page !== null).slice(0, PHASE2_QUERIES.length)
  return { pages, malformedItems: items.length - pages.length }
}

export function phase2ChargeCap(currentUsage: number, usageAtStart: number, monthlyCreditUsd: number, pilotBudgetUsd: number, actorMinimumUsd: number, knownActorSpendUsd = 0): number {
  if ([currentUsage, usageAtStart, monthlyCreditUsd, pilotBudgetUsd, actorMinimumUsd, knownActorSpendUsd].some((value) => !Number.isFinite(value) || value < 0)) throw new Error("Invalid Apify budget data. No scraping executed.")
  const monthlyHeadroom = Math.min(4.5, monthlyCreditUsd - 0.5) - currentUsage
  const pilotHeadroom = pilotBudgetUsd - Math.max(0, currentUsage - usageAtStart, knownActorSpendUsd)
  const cap = Math.max(0, Math.min(0.5, monthlyHeadroom, pilotHeadroom))
  return cap + 1e-9 >= actorMinimumUsd ? cap : 0
}

export function settledActorSpend(runs: Array<{ usageTotalUsd: number | null } | null | undefined>): number {
  let total = 0
  for (const run of runs) {
    if (!run) continue
    if (run.usageTotalUsd === null || !Number.isFinite(run.usageTotalUsd) || run.usageTotalUsd < 0) throw new Error("Prior Actor cost is unavailable. No scraping executed.")
    total += run.usageTotalUsd
  }
  return total
}
