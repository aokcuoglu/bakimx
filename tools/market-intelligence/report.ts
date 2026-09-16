import { readFile, mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { SITES, type NormalizedPage } from "./core"

export type Claim = { text: string; sources: string[] }
export type Profile = {
  positioning: Claim
  segment: Claim
  valueProposition: Claim
  features: Record<string, Claim>
  offer: Claim
  cta: Claim
  trust: Claim
  extraFeatures: Claim
}
export type Opportunity = {
  observation: string
  differentiation: string
  testMessage: string
  sources: string[]
  confidence: "HIGH" | "MEDIUM" | "LOW"
}
export type Curation = { profiles: Record<string, Profile>; opportunities: Opportunity[] }
export type RunRecord = { id: string; status: string; usageTotalUsd: number | null; datasetId: string | null; malformedItems: number; chargeCapUsd?: number; diagnostic?: string }
export type Manifest = {
  createdAt: string
  usageAtStartUsd: number
  usageAfterUsd: number | null
  monthlyCreditUsd?: number
  runs: Record<string, RunRecord>
}

const UNVERIFIED = "Doğrulanamadı"
export const FEATURE_ROWS = [
  ["Ücretsiz başlangıç", "freeStart"],
  ["Ruhsat okuma", "registrationReading"],
  ["İş emri", "workOrders"],
  ["Stok", "inventory"],
  ["Maliyet analizi", "costAnalysis"],
  ["Parça/VIN", "partsVin"],
  ["E-fatura", "einvoicing"],
  ["Araç geçmişi", "vehicleHistory"],
  ["Cari", "accounts"],
  ["Fatura", "invoicing"],
  ["Mobil kullanım", "mobile"],
  ["WhatsApp", "whatsapp"],
  ["Kullanıcı/şube yönetimi", "usersBranches"],
  ["Demo CTA", "demoCta"],
] as const

function unknownClaim(): Claim { return { text: UNVERIFIED, sources: [] } }
function defaultProfile(): Profile {
  return {
    positioning: unknownClaim(), segment: unknownClaim(), valueProposition: unknownClaim(),
    features: Object.fromEntries(FEATURE_ROWS.map(([, key]) => [key, unknownClaim()])),
    offer: unknownClaim(), cta: unknownClaim(), trust: unknownClaim(), extraFeatures: unknownClaim(),
  }
}

function urlList(claim: Claim): string {
  return claim.sources.length ? claim.sources.map((url) => `[kaynak](${url})`).join(", ") : ""
}
function claimLine(claim: Claim): string {
  return `${claim.text}${claim.sources.length ? ` — ${urlList(claim)}` : ""}`
}
function csvCell(value: string): string { return `"${value.replaceAll('"', '""')}"` }
function dollars(value: number | null | undefined): string { return value === null || value === undefined ? "not available" : `$${value.toFixed(5)}` }

async function optionalJson<T>(filename: string): Promise<T | null> {
  try { return JSON.parse(await readFile(filename, "utf8")) as T }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  }
}

function validateSources(curation: Curation, pages: NormalizedPage[]) {
  const known = new Set(pages.flatMap((page) => [page.sourceUrl, page.loadedUrl]))
  const claims = Object.values(curation.profiles).flatMap((profile) => [
    profile.positioning, profile.segment, profile.valueProposition, profile.offer, profile.cta, profile.trust, profile.extraFeatures,
    ...Object.values(profile.features ?? {}),
  ].filter((claim): claim is Claim => claim !== undefined))
  const urls = [...claims.flatMap((claim) => claim.sources), ...curation.opportunities.flatMap((opportunity) => opportunity.sources)]
  for (const url of urls) if (!known.has(url)) throw new Error(`Curation source was not collected: ${url}`)
  for (const claim of claims) if (claim.text !== UNVERIFIED && claim.sources.length === 0) throw new Error(`Curation claim lacks source: ${claim.text}`)
  if (curation.opportunities.length > 10) throw new Error("Maximum ten opportunities allowed.")
  for (const opportunity of curation.opportunities) if (!opportunity.sources.length) throw new Error("Opportunity lacks source URL.")
}

export async function buildReport(root: string): Promise<{ pages: number; sites: number }> {
  const rawDir = path.join(root, "tmp/market-intelligence/raw")
  const outputDir = path.join(root, "tools/market-intelligence/output")
  const manifestPath = path.join(root, "tmp/market-intelligence/manifest.json")
  const manifest = await optionalJson<Manifest>(manifestPath)
  const pages: NormalizedPage[] = []
  for (const site of SITES) {
    const sitePages = await optionalJson<NormalizedPage[]>(path.join(rawDir, `${site.id}.json`))
    if (sitePages) {
      if (!Array.isArray(sitePages)) throw new Error(`Local dataset for ${site.id} is malformed.`)
      pages.push(...sitePages)
    }
  }
  const curation = await optionalJson<Curation>(path.join(root, "tools/market-intelligence/curation.json")) ?? { profiles: {}, opportunities: [] }
  validateSources(curation, pages)
  const profiles = Object.fromEntries(SITES.map((site) => [site.id, { ...defaultProfile(), ...curation.profiles[site.id], features: { ...defaultProfile().features, ...curation.profiles[site.id]?.features } }])) as Record<string, Profile>
  const totalCost = manifest && Object.values(manifest.runs).every((run) => run.usageTotalUsd !== null)
    ? Object.values(manifest.runs).reduce((sum, run) => sum + (run.usageTotalUsd ?? 0), 0) : null
  const data = {
    generatedAt: new Date().toISOString(),
    methodology: "Official Apify Website Content Crawler; Cheerio; 8 pages and depth 2 per site. Claims are manually curated against collected URLs.",
    coverage: SITES.map((site) => ({ competitor: site.id, site: site.url, pages: pages.filter((page) => page.competitor === site.id).length, run: manifest?.runs[site.id] ?? null })),
    profiles,
    opportunities: curation.opportunities,
    cost: {
      usageAtStartUsd: manifest?.usageAtStartUsd ?? null,
      actorRuns: manifest ? Object.keys(manifest.runs).length : 0,
      totalPages: pages.length,
      pilotActorCostUsd: totalCost,
      usageAfterUsd: manifest?.usageAfterUsd ?? null,
      estimatedRemainingFreeCreditUsd: manifest?.usageAfterUsd === null || manifest?.usageAfterUsd === undefined ? null : (manifest.monthlyCreditUsd ?? 5) - manifest.usageAfterUsd,
    },
  }
  const csvHeader = ["competitor", "site", "pages", "positioning", "segment", "valueProposition", "offer", "cta", "trust", ...FEATURE_ROWS.map(([label]) => label), "sourceUrls"]
  const csvRows = SITES.map((site) => {
    const profile = profiles[site.id]
    const sources = new Set([
      profile.positioning, profile.segment, profile.valueProposition, profile.offer, profile.cta, profile.trust,
      ...Object.values(profile.features),
    ].flatMap((claim) => claim.sources))
    return [site.name, site.url, String(pages.filter((page) => page.competitor === site.id).length), profile.positioning.text,
      profile.segment.text, profile.valueProposition.text, profile.offer.text, profile.cta.text, profile.trust.text,
      ...FEATURE_ROWS.map(([, key]) => profile.features[key]?.text ?? UNVERIFIED), [...sources].join("; ")].map(csvCell).join(",")
  })
  const comparison = [...FEATURE_ROWS.map(([label, key]) => `| ${label} | ${SITES.map((site) => claimLine(profiles[site.id].features[key] ?? unknownClaim())).join(" | ")} |`),
    `| Ana pazarlama mesajı | ${SITES.map((site) => claimLine(profiles[site.id].valueProposition)).join(" | ")} |`]
  const coverage = SITES.map((site) => {
    const count = pages.filter((page) => page.competitor === site.id).length
    const run = manifest?.runs[site.id]
    const note = count === 0 ? (run?.diagnostic ?? "Cheerio ile anlamlı içerik alınamadı; dynamic rendering may be required.") : ""
    return `| ${site.name} | ${count}/8 | ${run?.status ?? "not available"} | ${run?.malformedItems ?? "not available"} | ${note} |`
  })
  const profileSection = SITES.map((site) => {
    const profile = profiles[site.id]
    return `### ${site.name}\n\n- Konumlandırma: ${claimLine(profile.positioning)}\n- Hedef segment: ${claimLine(profile.segment)}\n- Ana vaat: ${claimLine(profile.valueProposition)}\n- Teklif: ${claimLine(profile.offer)}\n- CTA: ${claimLine(profile.cta)}\n- Güven unsurları: ${claimLine(profile.trust)}\n- Diğer özellikler: ${claimLine(profile.extraFeatures)}`
  }).join("\n\n")
  const opportunitySection = curation.opportunities.length ? curation.opportunities.map((item, index) =>
    `### Fırsat ${index + 1}\n\n**Gözlem:** ${item.observation}\n\n**BakımX avantajı / farklılaşma ihtimali:** ${item.differentiation}\n\n**Test edilecek mesaj:** ${item.testMessage}\n\n**Kanıt:** ${item.sources.map((url) => `[kaynak](${url})`).join(", ")}\n\n**Confidence:** ${item.confidence}`
  ).join("\n\n") : "Doğrulanmış gözlemler kürate edilmedi; fırsat üretilmedi."
  const gaps = SITES.flatMap((site) => {
    const missing = FEATURE_ROWS.filter(([, key]) => profiles[site.id].features[key]?.text === UNVERIFIED).map(([label]) => label)
    return [`- ${site.name}: ${missing.length ? `${missing.join(", ")} taranan sayfalarda doğrulanamadı.` : "Tablodaki alanlar kaynaklı."}`]
  }).join("\n")
  const executiveHighlights = curation.opportunities.slice(0, 3).map((item) => `- ${item.observation} ${item.sources.map((url) => `[kaynak](${url})`).join(", ")}`).join("\n")
  const markdown = `# BakımX Apify Market Intelligence Pilot\n\nOluşturulma: ${data.generatedAt}. Kaynak kapsamı: yalnız bu pilotta toplanan sayfalar. "Doğrulanamadı" ürünün özelliği olmadığı anlamına gelmez.\n\n## 1. Executive Summary\n\n${pages.length} sayfa, ${SITES.filter((site) => pages.some((page) => page.competitor === site.id)).length} site için toplandı. Bulgular ve fırsatlar aşağıdaki kaynak URL'lere bağlıdır.\n\n${executiveHighlights}\n\n## 2. Crawl Coverage\n\n| Site | Toplanan sayfa | Run durumu | Geçersiz kayıt | Not |\n| --- | ---: | --- | ---: | --- |\n${coverage.join("\n")}\n\n## 3. BakımX Baseline\n\n${profileSection.split("\n\n### ")[0]}\n\n## 4. Rakip Bazlı Bulgular\n\n${profileSection.split("\n\n### ").slice(1).map((section) => `### ${section}`).join("\n\n")}\n\n## 5. Feature / Offer Comparison\n\n| Başlık | BakımX | PADOK / Hayat | ServisData | Kursoft |\n| --- | --- | --- | --- | --- |\n${comparison.join("\n")}\n\n## 6. Pricing & Trial Findings\n\n${SITES.map((site) => `- ${site.name}: ${claimLine(profiles[site.id].offer)}`).join("\n")}\n\n## 7. Messaging Patterns\n\n${SITES.map((site) => `- ${site.name}: ${claimLine(profiles[site.id].valueProposition)}`).join("\n")}\n\n## 8. BakımX Marketing Opportunities\n\n${opportunitySection}\n\n## 9. Data Gaps / Unverified Items\n\n${gaps}\n\n8 sayfalık Cheerio taraması sınırlı bir örneklemdir. Erişilemeyen veya JavaScript ile açılan sayfalar için yokluk sonucu çıkarılmadı.\n\n## 10. Recommended Phase 2\n\nYalnız öneri; bu pilot kapsamında çalıştırılmadı. Meta Ads Library için PADOK, ServisData ve Kursoft marka adlarıyla apify/facebook-ads-scraper üzerinde en fazla 10 sonuç/rakip, tahminen 3 Actor run. Google Search için marka adları ve "oto servis programı", "iş emri programı", "ruhsat okuma servis", "oto servis stok takip" anahtar kelimeleriyle apify/google-search-scraper üzerinde en fazla 10 sonuç/sorgu, tahminen 7 Actor run. Her run öncesi aylık kullanım $4.50 sınırı ve en az $0.50 serbest kredi koşulu kontrol edilmeli; ayrıca ayrı bir Phase 2 toplam bütçesi (öneri: en fazla $0.50) ve her Actor için bu bütçenin kalanından düşük sert ücret tavanı tanımlanmalı. Actor minimum ücretleri çalıştırmadan önce doğrulanmalı.\n\n## 11. Apify Cost Report\n\n- Apify usage before pilot: ${dollars(data.cost.usageAtStartUsd)}\n- Pilot Actor runs: ${data.cost.actorRuns}\n- Total pages collected: ${data.cost.totalPages}\n- Pilot Actor cost: ${dollars(data.cost.pilotActorCostUsd)}\n- Apify monthly usage after pilot: ${dollars(data.cost.usageAfterUsd)}\n- Estimated remaining free credit: ${dollars(data.cost.estimatedRemainingFreeCreditUsd)}\n\nRun maliyetleri tamamlanma sonrasında yeniden okundu; Apify tutarları gecikmeli güncellenebilir.\n`
  await mkdir(outputDir, { recursive: true })
  await Promise.all([
    writeFile(path.join(outputDir, "competitor-baseline.json"), `${JSON.stringify(data, null, 2)}\n`),
    writeFile(path.join(outputDir, "competitor-baseline.csv"), `${csvHeader.map(csvCell).join(",")}\n${csvRows.join("\n")}\n`),
    writeFile(path.join(outputDir, "competitor-analysis.md"), markdown),
  ])
  return { pages: pages.length, sites: SITES.filter((site) => pages.some((page) => page.competitor === site.id)).length }
}
