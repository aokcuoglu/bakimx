import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import type { SearchPage } from "./phase2-core"
import { META_SEARCHES, metaSearchUrl, type MetaAd, type MetaSummary } from "./phase2-meta"

export type Phase2Manifest = {
  createdAt: string
  usageAtStartUsd: number
  usageAfterUsd: number | null
  monthlyCreditUsd: number
  run: { id: string; status: string; datasetId: string | null; usageTotalUsd: number | null; chargeCapUsd: number; malformedItems: number } | null
  metaRun?: { id: string; status: string; datasetId: string | null; usageTotalUsd: number | null; chargeCapUsd: number; malformedItems: number; errorItems: number; summaryItems?: number }
  metaPageRun?: { id: string; status: string; datasetId: string | null; usageTotalUsd: number | null; chargeCapUsd: number; malformedItems: number; errorItems: number; summaryItems?: number }
}

type Finding = { observation: string; implication: string; sourceUrls: string[]; confidence: "HIGH" | "MEDIUM" | "LOW" }
type Curation = { findings: Finding[]; metaFindings?: Finding[] }
const knownDomains = ["bakimx.com", "hayatyazilim.com", "servisdata.com", "kursoft.com.tr"]

function csvCell(value: string | number | boolean): string { return `"${String(value).replaceAll('"', '""')}"` }
function usd(value: number | null | undefined): string { return value === null || value === undefined ? "not available" : `$${value.toFixed(5)}` }
function md(value: string): string { return value.replaceAll("|", "\\|").replaceAll("\n", " ").slice(0, 180) }

export async function buildPhase2Report(root: string): Promise<{ queries: number; results: number; ads: number; verifiedAds: number }> {
  const dataDir = path.join(root, "tmp/market-intelligence/phase2")
  const outputDir = path.join(root, "tools/market-intelligence/output")
  const pages = JSON.parse(await readFile(path.join(dataDir, "google-search.json"), "utf8")) as SearchPage[]
  let keywordAds: MetaAd[] = []
  let pageAds: MetaAd[] = []
  let keywordSummaries: MetaSummary[] = []
  let pageSummaries: MetaSummary[] = []
  try { keywordAds = JSON.parse(await readFile(path.join(dataDir, "meta-ads.json"), "utf8")) as MetaAd[] }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error }
  try { pageAds = JSON.parse(await readFile(path.join(dataDir, "meta-page-ads.json"), "utf8")) as MetaAd[] }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error }
  try { keywordSummaries = JSON.parse(await readFile(path.join(dataDir, "meta-summaries.json"), "utf8")) as MetaSummary[] }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error }
  try { pageSummaries = JSON.parse(await readFile(path.join(dataDir, "meta-page-summaries.json"), "utf8")) as MetaSummary[] }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error }
  const ads = [...new Map([...keywordAds, ...pageAds].map((ad) => [ad.adArchiveId, ad])).values()]
  const verifiedAds = ads.filter((ad) => ad.advertiserMatchesBrand).length
  const manifest = JSON.parse(await readFile(path.join(dataDir, "manifest.json"), "utf8")) as Phase2Manifest
  let curation: Curation = { findings: [] }
  try { curation = JSON.parse(await readFile(path.join(root, "tools/market-intelligence/phase2-curation.json"), "utf8")) as Curation }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error }
  const verifiedUrls = new Set(pages.flatMap((page) => [page.searchUrl, ...page.organicResults.map((result) => result.url)]))
  for (const finding of curation.findings) {
    if (!finding.sourceUrls.length || finding.sourceUrls.some((url) => !verifiedUrls.has(url))) throw new Error("Phase 2 finding cites a URL outside the collected dataset.")
  }
  const verifiedMetaUrls = new Set([...ads.flatMap((ad) => [ad.adUrl, ad.searchUrl]), ...keywordSummaries.map((summary) => summary.inputUrl), ...pageSummaries.map((summary) => summary.inputUrl)])
  for (const finding of curation.metaFindings ?? []) {
    if (!finding.sourceUrls.length || finding.sourceUrls.some((url) => !verifiedMetaUrls.has(url))) throw new Error("Meta finding cites a URL outside the collected dataset.")
  }
  const rows = pages.flatMap((page) => page.organicResults.map((result) => ({ ...result, query: page.query, searchUrl: page.searchUrl, domain: new URL(result.url).hostname.replace(/^www\./, "") })))
  const csv = ["query,position,domain,title,url,description,searchUrl", ...rows.map((row) => [row.query, row.position, row.domain, row.title, row.url, row.description, row.searchUrl].map(csvCell).join(","))].join("\n") + "\n"
  const lines = [
    "# Apify Market Intelligence — Phase 2 SERP Snapshot",
    "",
    `Collected: ${manifest.createdAt}. Query results are a dated Google snapshot; ranking and snippets may vary by time, location, and personalization. A search result is not proof of a product feature or an advertisement.`,
    "",
    "## Coverage",
    "",
    `Google Search: ${pages.length}/7 queries, ${rows.length} organic results, 1 Actor run. Each query was limited to one results page and at most 10 normalized organic results.`,
    manifest.metaRun ? `Meta Ads Library: ${Number(!!manifest.metaRun) + Number(!!manifest.metaPageRun)} Actor runs; ${keywordAds.length} normalized keyword results and ${pageAds.length} page-targeted results (${ads.length} unique ads). ${verifiedAds} ads were attributable to a tracked competitor. The dataset also held ${keywordSummaries.length + pageSummaries.length} query summary records. Search limits were 10 ads per URL. Residential proxy use was explicitly authorized for these runs. [Actor input](https://apify.com/apify/facebook-ads-scraper/input-schema).` : "Meta Ads Library: not run.",
    "",
    "## Search visibility in the collected top 10",
    "",
    "| Query | BakımX | Hayat/PADOK | ServisData | Kursoft | Search source |",
    "| --- | --- | --- | --- | --- | --- |",
    ...pages.map((page) => {
      const ranks = knownDomains.map((domain) => page.organicResults.find((result) => { const host = new URL(result.url).hostname.replace(/^www\./, ""); return host === domain || host.endsWith(`.${domain}`) })?.position)
      return `| ${md(page.query)} | ${ranks.map((rank) => rank ?? "Doğrulanamadı").join(" | ")} | [Google](${page.searchUrl}) |`
    }),
    "",
    "## Evidence samples",
    "",
    "Complete normalized SERP rows and spreadsheet CSV stay in the ignored local data directory. These links show the first three organic results per query.",
    "",
    ...pages.flatMap((page) => [`### ${md(page.query)}`, "", ...page.organicResults.slice(0, 3).map((result) => `${result.position}. [${md(result.title)}](${result.url})`), ""]),
    "## Meta Ad Library findings",
    "",
    "Keyword results are attributed to a competitor only when the advertiser page name matches the brand. Zero collected ads does not establish that the advertiser has no ads.",
    "",
    "| Search | Verified keyword results | Verified page results | Other keyword results | Evidence |",
    "| --- | ---: | ---: | ---: | --- |",
    ...META_SEARCHES.map((search) => {
      const keywordMatches = keywordAds.filter((ad) => ad.competitor === search.id && ad.advertiserMatchesBrand)
      const pageMatches = pageAds.filter((ad) => ad.competitor === search.id && ad.advertiserMatchesBrand)
      const other = keywordAds.filter((ad) => ad.competitor === search.id && !ad.advertiserMatchesBrand)
      const evidence = [...pageMatches, ...keywordMatches].slice(0, 3).map((ad) => `[ad ${ad.adArchiveId}](${ad.adUrl})`).join(", ") || `[search](${metaSearchUrl(search.keyword)})`
      return `| ${search.keyword} | ${keywordMatches.length} | ${pageMatches.length} | ${other.length} | ${evidence} |`
    }),
    "",
    "Page URL query summaries (a zero count describes only this Actor query, not the advertiser's overall activity):",
    ...pageSummaries.map((summary) => `- [${summary.pageName ?? summary.inputUrl}](${summary.inputUrl})${summary.pageId ? ` (page ID ${summary.pageId})` : ""}: ${summary.totalCount} returned; result complete: ${summary.isResultComplete ? "yes" : "no"}.`),
    "",
    ...(curation.metaFindings?.length ? curation.metaFindings.flatMap((finding, index) => [`${index + 1}. **Gözlem:** ${finding.observation} **BakımX testi:** ${finding.implication} **Confidence:** ${finding.confidence}. Kanıt: ${finding.sourceUrls.map((url) => `[kaynak](${url})`).join(", ")}.`, ""]) : ["Rakibe atfedilebilen reklam metni doğrulanamadı.", ""]),
    "",
    "## Marketing observations",
    "",
    ...(curation.findings.length ? curation.findings.flatMap((finding, index) => [`${index + 1}. **Gözlem:** ${finding.observation} **BakımX testi:** ${finding.implication} **Confidence:** ${finding.confidence}. Kanıt: ${finding.sourceUrls.map((url) => `[kaynak](${url})`).join(", ")}.`, ""]) : ["Henüz insan değerlendirmesi eklenmedi.", ""]),
    "## Data gaps",
    "",
    "SERP sonuçları organik görünürlüğü gösterir; arama hacmi, tıklama oranı, reklam harcaması veya ürün kapsamını doğrulamaz. Meta aramaları anahtar kelime eşleşmesidir; sayfa kimliği doğrulanmayan sonuçlar rakibe atfedilmez. Sonuç çıkmaması reklam yokluğu anlamına gelmez.",
    "",
    "## Apify cost",
    "",
    `- Monthly usage before Phase 2: ${usd(manifest.usageAtStartUsd)}`,
    `- Google Actor runs: ${manifest.run ? 1 : 0}`,
    `- Google Actor cost: ${usd(manifest.run?.usageTotalUsd)}`,
    `- Meta keyword Actor runs: ${manifest.metaRun ? 1 : 0}`,
    `- Meta keyword Actor cost: ${usd(manifest.metaRun?.usageTotalUsd)}`,
    `- Meta page Actor runs: ${manifest.metaPageRun ? 1 : 0}`,
    `- Meta page Actor cost: ${usd(manifest.metaPageRun?.usageTotalUsd)}`,
    `- Total Actor cost: ${manifest.run?.usageTotalUsd === null || !manifest.run || manifest.metaRun?.usageTotalUsd === null || !manifest.metaRun || manifest.metaPageRun?.usageTotalUsd === null || !manifest.metaPageRun ? "not available" : usd(manifest.run.usageTotalUsd + manifest.metaRun.usageTotalUsd + manifest.metaPageRun.usageTotalUsd)}`,
    `- Monthly usage after Phase 2: ${usd(manifest.usageAfterUsd)}`,
    `- Estimated remaining free credit: ${manifest.usageAfterUsd === null ? "not available" : usd(manifest.monthlyCreditUsd - manifest.usageAfterUsd)}`,
    `- Phase 2 spend from monthly usage delta: ${manifest.usageAfterUsd === null ? "not available" : usd(Math.max(0, manifest.usageAfterUsd - manifest.usageAtStartUsd))}`,
    "",
  ]
  await mkdir(outputDir, { recursive: true })
  await writeFile(path.join(dataDir, "phase2-search-baseline.csv"), csv, { mode: 0o600 })
  const metaCsv = ["competitor,advertiserMatchesBrand,pageName,adArchiveId,adUrl,startDate,isActive,headline,body,cta,linkUrl,searchUrl", ...ads.map((ad) => [ad.competitor, ad.advertiserMatchesBrand, ad.pageName ?? "", ad.adArchiveId, ad.adUrl, ad.startDate ?? "", ad.isActive ?? "", ad.headline ?? "", ad.body ?? "", ad.cta ?? "", ad.linkUrl ?? "", ad.searchUrl].map(csvCell).join(","))].join("\n") + "\n"
  await writeFile(path.join(dataDir, "phase2-meta-baseline.csv"), metaCsv, { mode: 0o600 })
  await writeFile(path.join(outputDir, "phase2-analysis.md"), lines.join("\n"))
  return { queries: pages.length, results: rows.length, ads: ads.length, verifiedAds }
}
