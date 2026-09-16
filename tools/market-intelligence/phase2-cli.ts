import { existsSync } from "node:fs"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { createApifyApi, type ActorRun } from "./apify"
import { assessBudget, ensureSucceeded, readBudgetConfig, requireToken } from "./core"
import { googleInput, normalizeSearchDataset, phase2ChargeCap, PHASE2_QUERIES } from "./phase2-core"
import { buildPhase2Report, type Phase2Manifest } from "./phase2-report"

const root = process.cwd()
const dataDir = path.join(root, "tmp/market-intelligence/phase2")
const manifestPath = path.join(dataDir, "manifest.json")
const rawPath = path.join(dataDir, "google-search.json")
const actorId = "apify~google-search-scraper" as const
const TERMINAL = new Set(["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"])

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
  if (manifest.run) {
    const latest = await api.getRun(manifest.run.id)
    manifest.run.status = latest.status
    manifest.run.usageTotalUsd = latest.usageTotalUsd
  }
  manifest.usageAfterUsd = await api.monthlyUsage()
  await saveManifest(manifest)
  const summary = await buildPhase2Report(root)
  console.log(`Phase 2 report: ${summary.queries} queries, ${summary.results} organic results; Google Actor cost ${manifest.run?.usageTotalUsd === null ? "not available" : `$${manifest.run?.usageTotalUsd.toFixed(5)}`}. Meta Actor not run (residential proxy constraint).`)
}

async function main(): Promise<void> {
  if (process.argv[2] === "analyze") {
    const summary = await buildPhase2Report(root)
    console.log(`Offline Phase 2 report: ${summary.queries} queries, ${summary.results} results; no Apify request.`)
  } else if (process.argv[2] === "run") await runPhase2()
  else throw new Error("Use run or analyze.")
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Phase 2 command failed.")
  process.exitCode = 1
})
