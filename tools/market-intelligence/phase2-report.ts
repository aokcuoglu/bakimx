import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import type { SearchPage } from "./phase2-core"

export type Phase2Manifest = {
  createdAt: string
  usageAtStartUsd: number
  usageAfterUsd: number | null
  monthlyCreditUsd: number
  run: { id: string; status: string; datasetId: string | null; usageTotalUsd: number | null; chargeCapUsd: number; malformedItems: number } | null
}

type Finding = { observation: string; implication: string; sourceUrls: string[]; confidence: "HIGH" | "MEDIUM" | "LOW" }
type Curation = { findings: Finding[] }
const knownDomains = ["bakimx.com", "hayatyazilim.com", "servisdata.com", "kursoft.com.tr"]

function csvCell(value: string | number): string { return `"${String(value).replaceAll('"', '""')}"` }
function usd(value: number | null | undefined): string { return value === null || value === undefined ? "not available" : `$${value.toFixed(5)}` }
function md(value: string): string { return value.replaceAll("|", "\\|").replaceAll("\n", " ").slice(0, 180) }

export async function buildPhase2Report(root: string): Promise<{ queries: number; results: number }> {
  const dataDir = path.join(root, "tmp/market-intelligence/phase2")
  const outputDir = path.join(root, "tools/market-intelligence/output")
  const pages = JSON.parse(await readFile(path.join(dataDir, "google-search.json"), "utf8")) as SearchPage[]
  const manifest = JSON.parse(await readFile(path.join(dataDir, "manifest.json"), "utf8")) as Phase2Manifest
  let curation: Curation = { findings: [] }
  try { curation = JSON.parse(await readFile(path.join(root, "tools/market-intelligence/phase2-curation.json"), "utf8")) as Curation }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error }
  const verifiedUrls = new Set(pages.flatMap((page) => [page.searchUrl, ...page.organicResults.map((result) => result.url)]))
  for (const finding of curation.findings) {
    if (!finding.sourceUrls.length || finding.sourceUrls.some((url) => !verifiedUrls.has(url))) throw new Error("Phase 2 finding cites a URL outside the collected dataset.")
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
    "Meta Ads Library: not run. The official Actor's developer has stated that it forces residential proxy use internally, which conflicts with this pilot's no-residential-proxy constraint. [Actor issue](https://apify.com/apify/facebook-ads-scraper/issues/residential-proxy-fo-YD0alNTBZG9sg23yG).",
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
    "## Marketing observations",
    "",
    ...(curation.findings.length ? curation.findings.flatMap((finding, index) => [`${index + 1}. **Gözlem:** ${finding.observation} **BakımX testi:** ${finding.implication} **Confidence:** ${finding.confidence}. Kanıt: ${finding.sourceUrls.map((url) => `[kaynak](${url})`).join(", ")}.`, ""]) : ["Henüz insan değerlendirmesi eklenmedi.", ""]),
    "## Data gaps",
    "",
    "SERP sonuçları organik görünürlüğü gösterir; arama hacmi, tıklama oranı, reklam harcaması, ürün kapsamı veya rakibin reklam yayınlayıp yayınlamadığını doğrulamaz. Meta reklam metinleri bu aşamada doğrulanamadı.",
    "",
    "## Apify cost",
    "",
    `- Monthly usage before Phase 2: ${usd(manifest.usageAtStartUsd)}`,
    `- Google Actor runs: ${manifest.run ? 1 : 0}`,
    `- Google Actor cost: ${usd(manifest.run?.usageTotalUsd)}`,
    `- Monthly usage after Phase 2: ${usd(manifest.usageAfterUsd)}`,
    `- Estimated remaining free credit: ${manifest.usageAfterUsd === null ? "not available" : usd(manifest.monthlyCreditUsd - manifest.usageAfterUsd)}`,
    `- Phase 2 spend from monthly usage delta: ${manifest.usageAfterUsd === null ? "not available" : usd(Math.max(0, manifest.usageAfterUsd - manifest.usageAtStartUsd))}`,
    "",
  ]
  await mkdir(outputDir, { recursive: true })
  await writeFile(path.join(dataDir, "phase2-search-baseline.csv"), csv, { mode: 0o600 })
  await writeFile(path.join(outputDir, "phase2-analysis.md"), lines.join("\n"))
  return { queries: pages.length, results: rows.length }
}
