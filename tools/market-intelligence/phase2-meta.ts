export const META_SEARCHES = [
  { id: "padok", keyword: "PADOK", pageNames: ["padok", "hayat yazılım", "hayat yazilim"] },
  { id: "servisdata", keyword: "ServisData", pageNames: ["servisdata"] },
  { id: "kursoft", keyword: "Kursoft", pageNames: ["kursoft"] },
] as const
export const META_PAGE_SEARCHES = [
  { id: "padok", url: "https://www.facebook.com/hayatyazilim/" },
  { id: "kursoft", url: "https://www.facebook.com/Kursoft" },
] as const

export type MetaAd = {
  competitor: string
  searchUrl: string
  adUrl: string
  adArchiveId: string
  pageId: string | null
  pageName: string | null
  pageUrl: string | null
  advertiserMatchesBrand: boolean
  startDate: string | null
  endDate: string | null
  isActive: boolean | null
  headline: string | null
  body: string | null
  cta: string | null
  linkUrl: string | null
  linkDescription: string | null
  fetchedAt: string
  actorRunId: string
}

export type MetaSummary = {
  inputUrl: string
  totalCount: number
  isResultComplete: boolean
  pageId: string | null
  pageName: string | null
}

export function metaSearchUrl(keyword: string): string {
  const query = new URLSearchParams({ active_status: "all", ad_type: "all", country: "TR", is_targeted_country: "false", media_type: "all", q: keyword, search_type: "keyword_unordered" })
  return `https://www.facebook.com/ads/library/?${query}`
}

export function metaInput() {
  return {
    startUrls: META_SEARCHES.map((search) => ({ url: metaSearchUrl(search.keyword) })),
    resultsLimit: 10,
    onlyTotal: false,
    includeAboutPage: false,
    isDetailsPerAd: false,
    enrichWithEcommerceData: false,
  }
}

export function metaPageInput() {
  return {
    startUrls: META_PAGE_SEARCHES.map((page) => ({ url: page.url })),
    resultsLimit: 10,
    onlyTotal: false,
    includeAboutPage: false,
    isDetailsPerAd: false,
    enrichWithEcommerceData: false,
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function string(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null }
function webUrl(value: unknown): string | null {
  const raw = string(value)
  if (!raw) return null
  try { const url = new URL(raw); return url.protocol === "https:" || url.protocol === "http:" ? url.href : null }
  catch { return null }
}
function text(value: unknown): string | null { return string(value)?.slice(0, 5000) ?? null }

export function normalizeMetaAd(item: unknown, actorRunId: string, fetchedAt: string): MetaAd | null {
  const source = record(item)
  if (!source || source.error) return null
  const inputUrl = webUrl(source.inputUrl)
  if (!inputUrl) return null
  let keyword: string | null = null
  try { keyword = new URL(inputUrl).searchParams.get("q") } catch { return null }
  const snapshot = record(source.snapshot)
  const pageName = string(source.pageName) ?? string(snapshot?.pageName)
  const lowerName = pageName?.toLocaleLowerCase("tr") ?? ""
  const byKeyword = META_SEARCHES.find((entry) => entry.keyword.toLowerCase() === keyword?.toLowerCase())
  const byPageUrl = META_PAGE_SEARCHES.find((entry) => entry.url.replace(/\/$/, "").toLowerCase() === inputUrl.replace(/\/$/, "").toLowerCase())
  const byName = META_SEARCHES.find((entry) => entry.pageNames.some((name) => lowerName.includes(name)))
  const search = byKeyword ?? META_SEARCHES.find((entry) => entry.id === byPageUrl?.id) ?? byName
  if (!search) return null
  const rawId = source.adArchiveId ?? source.adArchiveID
  const adArchiveId = typeof rawId === "string" || typeof rawId === "number" ? String(rawId) : null
  if (!adArchiveId || !/^\d{5,25}$/.test(adArchiveId)) return null
  const card = Array.isArray(snapshot?.cards) ? record(snapshot.cards[0]) : null
  const advertiserMatchesBrand = search.pageNames.some((name) => lowerName.includes(name))
  return {
    competitor: search.id,
    searchUrl: inputUrl,
    adUrl: `https://www.facebook.com/ads/library/?id=${encodeURIComponent(adArchiveId)}`,
    adArchiveId,
    pageId: string(source.pageId ?? source.pageID),
    pageName,
    pageUrl: webUrl(snapshot?.pageProfileUri) ?? webUrl(source.facebookUrl),
    advertiserMatchesBrand,
    startDate: string(source.startDateFormatted),
    endDate: string(source.endDateFormatted),
    isActive: typeof source.isActive === "boolean" ? source.isActive : null,
    headline: text(snapshot?.title) ?? text(card?.title),
    body: text(record(snapshot?.body)?.text) ?? text(card?.body),
    cta: text(snapshot?.ctaText) ?? text(card?.ctaText),
    linkUrl: webUrl(snapshot?.linkUrl) ?? webUrl(card?.linkUrl),
    linkDescription: text(snapshot?.linkDescription) ?? text(card?.linkDescription),
    fetchedAt,
    actorRunId,
  }
}

export function normalizeMetaSummary(item: unknown): MetaSummary | null {
  const source = record(item)
  if (!source || source.error || !Array.isArray(source.results)) return null
  const inputUrl = webUrl(source.inputUrl)
  if (!inputUrl || !Number.isInteger(source.totalCount) || (source.totalCount as number) < 0 || typeof source.isResultComplete !== "boolean") return null
  const known = META_SEARCHES.some((entry) => metaSearchUrl(entry.keyword) === inputUrl) || META_PAGE_SEARCHES.some((entry) => entry.url.replace(/\/$/, "") === inputUrl.replace(/\/$/, ""))
  if (!known) return null
  const page = record(record(source.pageInfo)?.page)
  const pageId = typeof page?.id === "number" && Number.isInteger(page.id) ? String(page.id) : string(page?.id)
  return { inputUrl, totalCount: source.totalCount as number, isResultComplete: source.isResultComplete, pageId, pageName: string(page?.name) }
}

export function normalizeMetaDataset(items: unknown, actorRunId: string, fetchedAt = new Date().toISOString()) {
  if (!Array.isArray(items)) throw new Error("Meta Ads dataset is malformed; expected an array.")
  const ads: MetaAd[] = []
  const summaries: MetaSummary[] = []
  let errorItems = 0
  let malformedItems = 0
  for (const item of items) {
    if (record(item)?.error) { errorItems++; continue }
    const summary = normalizeMetaSummary(item)
    if (summary) { summaries.push(summary); continue }
    const ad = normalizeMetaAd(item, actorRunId, fetchedAt)
    if (ad) ads.push(ad)
    else malformedItems++
  }
  return { ads: ads.slice(0, 30), summaries, malformedItems, errorItems }
}
