export const SITES = [
  { id: "bakimx", name: "BakımX", url: "https://bakimx.com" },
  { id: "padok", name: "PADOK / Hayat Yazılım", url: "https://hayatyazilim.com" },
  { id: "servisdata", name: "ServisData", url: "https://www.servisdata.com" },
  { id: "kursoft", name: "Kursoft", url: "https://www.kursoft.com.tr" },
] as const

export type Site = (typeof SITES)[number]
export type NormalizedPage = {
  competitor: string
  sourceUrl: string
  loadedUrl: string
  pageTitle: string | null
  metaDescription: string | null
  language: string | null
  crawlDepth: number | null
  markdown: string
  text: string
  fetchedAt: string
  actorRunId: string
}

export type BudgetConfig = { monthlyCreditUsd: number; pilotBudgetUsd: number }
export type BudgetState = {
  allowed: boolean
  reason: string | null
  remainingMonthlyCredit: number
  pilotSpend: number
  maxRunChargeUsd: number
}

const MONTHLY_HARD_STOP = 4.5
const MAX_RUN_CHARGE = 0.12

export function requireToken(token: string | undefined): string {
  if (!token?.trim()) throw new Error("APIFY_API_TOKEN is missing. No scraping executed.")
  return token.trim()
}

function positiveBudget(value: string | undefined, fallback: number, ceiling: number, name: string): number {
  const parsed = value === undefined || value === "" ? fallback : Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > ceiling) {
    throw new Error(`${name} must be greater than 0 and at most ${ceiling}.`)
  }
  return parsed
}

export function readBudgetConfig(env: NodeJS.ProcessEnv): BudgetConfig {
  return {
    monthlyCreditUsd: positiveBudget(env.APIFY_MONTHLY_CREDIT_USD, 5, 5, "APIFY_MONTHLY_CREDIT_USD"),
    pilotBudgetUsd: positiveBudget(env.APIFY_PILOT_BUDGET_USD, 0.5, 0.5, "APIFY_PILOT_BUDGET_USD"),
  }
}

export function assessBudget(currentMonthlyUsage: number, usageAtStartUsd: number, config: BudgetConfig): BudgetState {
  if (!Number.isFinite(currentMonthlyUsage) || currentMonthlyUsage < 0 || !Number.isFinite(usageAtStartUsd) || usageAtStartUsd < 0) {
    throw new Error("Apify monthly usage is unavailable or malformed. No scraping executed.")
  }
  const remainingMonthlyCredit = config.monthlyCreditUsd - currentMonthlyUsage
  const pilotSpend = Math.max(0, currentMonthlyUsage - usageAtStartUsd)
  const monthlyHeadroom = Math.min(MONTHLY_HARD_STOP, config.monthlyCreditUsd - 0.5) - currentMonthlyUsage
  const pilotHeadroom = config.pilotBudgetUsd - pilotSpend
  const maxRunChargeUsd = Math.max(0, Math.min(MAX_RUN_CHARGE, monthlyHeadroom, pilotHeadroom))
  if (currentMonthlyUsage >= MONTHLY_HARD_STOP || remainingMonthlyCredit < 0.5 || monthlyHeadroom <= 0) {
    return { allowed: false, reason: "Apify free credit safety limit reached. No scraping executed.", remainingMonthlyCredit, pilotSpend, maxRunChargeUsd: 0 }
  }
  if (pilotSpend >= config.pilotBudgetUsd || maxRunChargeUsd <= 0) {
    return { allowed: false, reason: "Apify pilot budget limit reached. No further Actor runs executed.", remainingMonthlyCredit, pilotSpend, maxRunChargeUsd: 0 }
  }
  return { allowed: true, reason: null, remainingMonthlyCredit, pilotSpend, maxRunChargeUsd }
}

export function reservedRunAllowance(budget: BudgetState, usageAtStartUsd: number, config: BudgetConfig, reservedUsd: number): number {
  if (!budget.allowed || !Number.isFinite(reservedUsd) || reservedUsd < 0) return 0
  const monthlyThreshold = Math.min(MONTHLY_HARD_STOP, config.monthlyCreditUsd - 0.5)
  return Math.max(0, Math.min(
    budget.maxRunChargeUsd,
    config.pilotBudgetUsd - reservedUsd,
    monthlyThreshold - usageAtStartUsd - reservedUsd,
  ))
}

export function actorInput(site: Site) {
  const excludedBySite: Partial<Record<Site["id"], string[]>> = {
    bakimx: ["https://bakimx.com/privacy", "https://bakimx.com/cdn-cgi/**"],
    padok: ["https://hayatyazilim.com/egitim/**", "https://hayatyazilim.com/surum-notlari/**", "https://hayatyazilim.com/kontor/**"],
  }
  return {
    startUrls: [{ url: site.url }],
    excludeUrlGlobs: (excludedBySite[site.id] ?? []).map((glob) => ({ glob })),
    crawlerType: "cheerio",
    maxCrawlDepth: 2,
    maxCrawlPages: 8,
    maxResults: 8,
    useSitemaps: false,
    useLlmsTxt: false,
    respectRobotsTxtFile: true,
    summarize: false,
    saveFiles: false,
    saveHtml: false,
    saveHtmlAsFile: false,
    saveScreenshots: false,
    saveMarkdown: true,
    initialConcurrency: 1,
    maxConcurrency: 2,
    maxRequestRetries: 1,
    dynamicContentWaitSecs: 0,
    proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: [] },
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

export function normalizeItem(item: unknown, site: Site, actorRunId: string, now: string): NormalizedPage | null {
  const source = record(item)
  if (!source) return null
  const crawl = record(source.crawl)
  const metadata = record(source.metadata)
  const sourceUrl = stringOrNull(source.url)
  const loadedUrl = stringOrNull(crawl?.loadedUrl) ?? sourceUrl
  if (!sourceUrl || !loadedUrl) return null
  try {
    const expectedHost = new URL(site.url).hostname.replace(/^www\./, "")
    for (const url of [sourceUrl, loadedUrl]) {
      const host = new URL(url).hostname.replace(/^www\./, "")
      if (host !== expectedHost && !host.endsWith(`.${expectedHost}`)) return null
    }
  } catch {
    return null
  }
  const depth = crawl?.depth
  const fetchedAt = stringOrNull(crawl?.loadedTime)
  return {
    competitor: site.id,
    sourceUrl,
    loadedUrl,
    pageTitle: stringOrNull(metadata?.title),
    metaDescription: stringOrNull(metadata?.description),
    language: stringOrNull(metadata?.languageCode),
    crawlDepth: typeof depth === "number" && Number.isInteger(depth) && depth >= 0 ? depth : null,
    markdown: typeof source.markdown === "string" ? source.markdown : "",
    text: typeof source.text === "string" ? source.text : "",
    fetchedAt: fetchedAt && !Number.isNaN(Date.parse(fetchedAt)) ? fetchedAt : now,
    actorRunId,
  }
}

export function normalizeDataset(items: unknown, site: Site, actorRunId: string, now = new Date().toISOString()) {
  if (!Array.isArray(items)) throw new Error("Apify dataset is malformed; expected an array.")
  const pages = items.map((item) => normalizeItem(item, site, actorRunId, now)).filter((page): page is NormalizedPage => page !== null).slice(0, 8)
  return { pages, malformedItems: items.length - pages.length }
}

export function ensureSucceeded(status: string): void {
  if (status !== "SUCCEEDED") throw new Error(`Apify Actor run ended with status ${status}. No automatic retry executed.`)
}
