import { existsSync } from "node:fs"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { createApifyApi, type ActorRun } from "./apify"
import { assessBudget, ensureSucceeded, readBudgetConfig, requireToken } from "./core"
import { googleInput, normalizeSearchDataset, phase2ChargeCap, PHASE2_QUERIES, settledActorSpend } from "./phase2-core"
import { metaInput, metaPageInput, normalizeMetaDataset } from "./phase2-meta"
import { buildPhase2Report, type Phase2Manifest } from "./phase2-report"

const root = process.cwd()
const dataDir = path.join(root, "tmp/market-intelligence/phase2")
const manifestPath = path.join(dataDir, "manifest.json")
const rawPath = path.join(dataDir, "google-search.json")
const metaRawPath = path.join(dataDir, "meta-ads.json")
const metaPageRawPath = path.join(dataDir, "meta-page-ads.json")
const metaSummaryPath = path.join(dataDir, "meta-summaries.json")
const metaPageSummaryPath = path.join(dataDir, "meta-page-summaries.json")
const actorId = "apify~google-search-scraper" as const
const metaActorId = "apify~facebook-ads-scraper" as const
const TERMINAL = new Set(["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"])
function settledSpend(manifest: Phase2Manifest): number {
  return settledActorSpend([manifest.run, manifest.metaRun, manifest.metaPageRun])
}

for (const name of [".env.local", ".env"]) {
  const file = path.join(root, name)
  if (existsSync(file) && typeof process.loadEnvFile === "function") process.loadEnvFile(file)
}

async function saveManifest(manifest: Phase2Manifest): Promise<void> {
  await mkdir(dataDir, { recursive: true })
  const temporary = `${manifestPath}.tmp`
  await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
  await rename(temporary, manifestPath)
}

async function loadManifest(): Promise<Phase2Manifest | null> {
  try { return JSON.parse(await readFile(manifestPath, "utf8")) as Phase2Manifest }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error }
}

async function waitForRun(api: ReturnType<typeof createApifyApi>, run: ActorRun): Promise<ActorRun> {
  let current = run
  for (let attempt = 0; attempt < 90 && !TERMINAL.has(current.status); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 3000))
    current = await api.getRun(run.id)
  }
  if (!TERMINAL.has(current.status)) throw new Error(`Actor run ${run.id} is still active; no new run will start.`)
  await new Promise((resolve) => setTimeout(resolve, 10000))
  return api.getRun(run.id)
}

async function collectMeta(api: ReturnType<typeof createApifyApi>, manifest: Phase2Manifest, config: ReturnType<typeof readBudgetConfig>): Promise<void> {
  if (existsSync(metaRawPath)) {
    if (!existsSync(metaSummaryPath) && manifest.metaRun?.datasetId) {
      const result = normalizeMetaDataset(await api.datasetItems(manifest.metaRun.datasetId, 30), manifest.metaRun.id)
      manifest.metaRun.malformedItems = result.malformedItems
      manifest.metaRun.errorItems = result.errorItems
      manifest.metaRun.summaryItems = result.summaries.length
      await writeFile(metaSummaryPath, `${JSON.stringify(result.summaries, null, 2)}\n`, { mode: 0o600 })
      await saveManifest(manifest)
    }
    console.log("Local Meta dataset exists; no Actor run started.")
    return
  }
  let run: ActorRun
  if (manifest.metaRun) {
    console.log(`Resuming recorded Meta Actor run ${manifest.metaRun.id}; no new run started.`)
    run = await api.getRun(manifest.metaRun.id)
  } else {
    const current = await api.monthlyUsage()
    const state = assessBudget(current, manifest.usageAtStartUsd, config)
    if (!state.allowed) { console.log(state.reason); return }
    const minimum = await api.actorMinimumCharge(metaActorId)
    if (minimum === null) throw new Error("Meta Actor minimum charge is unavailable. No scraping executed.")
    const cap = Math.min(0.2, phase2ChargeCap(current, manifest.usageAtStartUsd, config.monthlyCreditUsd, config.pilotBudgetUsd, minimum, settledSpend(manifest)))
    if (cap + 1e-9 < minimum) { console.log("Meta Actor minimum charge exceeds safe remaining Phase 2 budget. No scraping executed."); return }
    const input = metaInput()
    await api.validateActorInput(metaActorId, input)
    run = await api.startResearchRun(metaActorId, input, cap)
    manifest.metaRun = { id: run.id, status: run.status, datasetId: run.defaultDatasetId, usageTotalUsd: null, chargeCapUsd: cap, malformedItems: 0, errorItems: 0 }
    await saveManifest(manifest)
    console.log(`Meta Actor run ${run.id} started with $${cap.toFixed(5)} hard charge cap; 3 searches, at most 10 ads/search.`)
  }
  run = await waitForRun(api, run)
  manifest.metaRun!.status = run.status
  manifest.metaRun!.datasetId = run.defaultDatasetId
  manifest.metaRun!.usageTotalUsd = run.usageTotalUsd
  manifest.usageAfterUsd = await api.monthlyUsage()
  await saveManifest(manifest)
  ensureSucceeded(run.status)
  if (!run.defaultDatasetId) throw new Error("Meta Actor run has no dataset ID.")
  const result = normalizeMetaDataset(await api.datasetItems(run.defaultDatasetId, 30), run.id)
  manifest.metaRun!.malformedItems = result.malformedItems
  manifest.metaRun!.errorItems = result.errorItems
  manifest.metaRun!.summaryItems = result.summaries.length
  await writeFile(metaRawPath, `${JSON.stringify(result.ads, null, 2)}\n`, { mode: 0o600 })
  await writeFile(metaSummaryPath, `${JSON.stringify(result.summaries, null, 2)}\n`, { mode: 0o600 })
  await saveManifest(manifest)
  console.log(`Meta Ads: ${result.ads.length} ads saved; ${result.summaries.length} summary items; ${result.errorItems} error items; ${result.malformedItems} malformed items.`)
}

async function collectMetaPages(api: ReturnType<typeof createApifyApi>, manifest: Phase2Manifest, config: ReturnType<typeof readBudgetConfig>): Promise<void> {
  if (existsSync(metaPageRawPath)) {
    if (!existsSync(metaPageSummaryPath) && manifest.metaPageRun?.datasetId) {
      const result = normalizeMetaDataset(await api.datasetItems(manifest.metaPageRun.datasetId, 20), manifest.metaPageRun.id)
      manifest.metaPageRun.malformedItems = result.malformedItems
      manifest.metaPageRun.errorItems = result.errorItems
      manifest.metaPageRun.summaryItems = result.summaries.length
      await writeFile(metaPageSummaryPath, `${JSON.stringify(result.summaries, null, 2)}\n`, { mode: 0o600 })
      await saveManifest(manifest)
    }
    console.log("Local Meta page dataset exists; no Actor run started.")
    return
  }
  let run: ActorRun
  if (manifest.metaPageRun) {
    console.log(`Resuming recorded Meta page Actor run ${manifest.metaPageRun.id}; no new run started.`)
    run = await api.getRun(manifest.metaPageRun.id)
  } else {
    const current = await api.monthlyUsage()
    const state = assessBudget(current, manifest.usageAtStartUsd, config)
    if (!state.allowed) { console.log(state.reason); return }
    const minimum = await api.actorMinimumCharge(metaActorId)
    if (minimum === null) throw new Error("Meta Actor minimum charge is unavailable. No scraping executed.")
    const cap = Math.min(0.13, phase2ChargeCap(current, manifest.usageAtStartUsd, config.monthlyCreditUsd, config.pilotBudgetUsd, minimum, settledSpend(manifest)))
    if (cap + 1e-9 < minimum) { console.log("Meta Actor minimum charge exceeds safe remaining Phase 2 budget. No scraping executed."); return }
    const input = metaPageInput()
    await api.validateActorInput(metaActorId, input)
    run = await api.startResearchRun(metaActorId, input, cap)
    manifest.metaPageRun = { id: run.id, status: run.status, datasetId: run.defaultDatasetId, usageTotalUsd: null, chargeCapUsd: cap, malformedItems: 0, errorItems: 0 }
    await saveManifest(manifest)
    console.log(`Meta page Actor run ${run.id} started with $${cap.toFixed(5)} hard charge cap; 2 page URLs, at most 10 ads/page.`)
  }
  run = await waitForRun(api, run)
  manifest.metaPageRun!.status = run.status
  manifest.metaPageRun!.datasetId = run.defaultDatasetId
  manifest.metaPageRun!.usageTotalUsd = run.usageTotalUsd
  manifest.usageAfterUsd = await api.monthlyUsage()
  await saveManifest(manifest)
  ensureSucceeded(run.status)
  if (!run.defaultDatasetId) throw new Error("Meta page Actor run has no dataset ID.")
  const result = normalizeMetaDataset(await api.datasetItems(run.defaultDatasetId, 20), run.id)
  manifest.metaPageRun!.malformedItems = result.malformedItems
  manifest.metaPageRun!.errorItems = result.errorItems
  manifest.metaPageRun!.summaryItems = result.summaries.length
  await writeFile(metaPageRawPath, `${JSON.stringify(result.ads, null, 2)}\n`, { mode: 0o600 })
  await writeFile(metaPageSummaryPath, `${JSON.stringify(result.summaries, null, 2)}\n`, { mode: 0o600 })
  await saveManifest(manifest)
  console.log(`Meta page search: ${result.ads.length} ads saved; ${result.summaries.length} summary items; ${result.errorItems} error items; ${result.malformedItems} malformed items.`)
}

async function runPhase2(): Promise<void> {
  const api = createApifyApi(requireToken(process.env.APIFY_API_TOKEN))
  const config = readBudgetConfig(process.env)
  const before = await api.monthlyUsage()
  const preflight = assessBudget(before, before, config)
  console.log(`Phase 2 preflight: monthly usage $${before.toFixed(5)}; estimated remaining free credit $${preflight.remainingMonthlyCredit.toFixed(5)}.`)
  if (!preflight.allowed) { console.log(preflight.reason); return }
  let manifest = await loadManifest()
  if (!manifest) {
    manifest = { createdAt: new Date().toISOString(), usageAtStartUsd: before, usageAfterUsd: null, monthlyCreditUsd: config.monthlyCreditUsd, run: null }
    await saveManifest(manifest)
  }
  if (existsSync(rawPath)) {
    console.log("Local Google dataset exists; no Actor run started.")
  } else {
    let run: ActorRun
    if (manifest.run) {
      console.log(`Resuming recorded Google Actor run ${manifest.run.id}; no new run started.`)
      run = await api.getRun(manifest.run.id)
    } else {
      const minimum = await api.actorMinimumCharge(actorId)
      if (minimum === null) throw new Error("Actor minimum charge is unavailable. No scraping executed.")
      const current = await api.monthlyUsage()
      const state = assessBudget(current, manifest.usageAtStartUsd, config)
      if (!state.allowed) { console.log(state.reason); return }
      const cap = phase2ChargeCap(current, manifest.usageAtStartUsd, config.monthlyCreditUsd, config.pilotBudgetUsd, minimum)
      if (cap === 0) { console.log("Actor minimum charge exceeds safe remaining Phase 2 budget. No scraping executed."); return }
      const input = googleInput()
      await api.validateActorInput(actorId, input)
      run = await api.startResearchRun(actorId, input, cap)
      manifest.run = { id: run.id, status: run.status, datasetId: run.defaultDatasetId, usageTotalUsd: null, chargeCapUsd: cap, malformedItems: 0 }
      await saveManifest(manifest)
      console.log(`Google Actor run ${run.id} started with $${cap.toFixed(5)} hard charge cap for ${PHASE2_QUERIES.length} queries.`)
    }
    run = await waitForRun(api, run)
    manifest.run!.status = run.status
    manifest.run!.datasetId = run.defaultDatasetId
    manifest.run!.usageTotalUsd = run.usageTotalUsd
    manifest.usageAfterUsd = await api.monthlyUsage()
    await saveManifest(manifest)
    ensureSucceeded(run.status)
    if (!run.defaultDatasetId) throw new Error("Google Actor run has no dataset ID.")
    const result = normalizeSearchDataset(await api.datasetItems(run.defaultDatasetId, PHASE2_QUERIES.length), run.id)
    manifest.run!.malformedItems = result.malformedItems
    await writeFile(rawPath, `${JSON.stringify(result.pages, null, 2)}\n`, { mode: 0o600 })
    await saveManifest(manifest)
    console.log(`Google Search: ${result.pages.length} query pages saved; ${result.malformedItems} malformed items skipped.`)
  }
  await collectMeta(api, manifest, config)
  await collectMetaPages(api, manifest, config)
  if (manifest.run) {
    const latest = await api.getRun(manifest.run.id)
    manifest.run.status = latest.status
    manifest.run.usageTotalUsd = latest.usageTotalUsd
  }
  if (manifest.metaRun) {
    const latest = await api.getRun(manifest.metaRun.id)
    manifest.metaRun.status = latest.status
    manifest.metaRun.usageTotalUsd = latest.usageTotalUsd
  }
  if (manifest.metaPageRun) {
    const latest = await api.getRun(manifest.metaPageRun.id)
    manifest.metaPageRun.status = latest.status
    manifest.metaPageRun.usageTotalUsd = latest.usageTotalUsd
  }
  manifest.usageAfterUsd = await api.monthlyUsage()
  await saveManifest(manifest)
  const summary = await buildPhase2Report(root)
  console.log(`Phase 2 report: ${summary.queries} queries, ${summary.results} organic results, ${summary.ads} Meta query results (${summary.verifiedAds} attributable to tracked competitors); Google Actor cost ${manifest.run?.usageTotalUsd === null ? "not available" : `$${manifest.run?.usageTotalUsd.toFixed(5)}`}; Meta keyword cost ${manifest.metaRun?.usageTotalUsd === null || !manifest.metaRun ? "not available" : `$${manifest.metaRun.usageTotalUsd.toFixed(5)}`}; Meta page cost ${manifest.metaPageRun?.usageTotalUsd === null || !manifest.metaPageRun ? "not available" : `$${manifest.metaPageRun.usageTotalUsd.toFixed(5)}`}.`)
}

async function main(): Promise<void> {
  if (process.argv[2] === "analyze") {
    const summary = await buildPhase2Report(root)
    console.log(`Offline Phase 2 report: ${summary.queries} queries, ${summary.results} organic results, ${summary.ads} Meta query results (${summary.verifiedAds} attributable to tracked competitors); no Apify request.`)
  } else if (process.argv[2] === "run") await runPhase2()
  else throw new Error("Use run or analyze.")
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Phase 2 command failed.")
  process.exitCode = 1
})
