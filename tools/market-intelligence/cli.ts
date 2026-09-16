import { existsSync } from "node:fs"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { createApifyApi, type ActorRun, type ApifyApi } from "./apify"
import { SITES, actorInput, assessBudget, ensureSucceeded, normalizeDataset, readBudgetConfig, requireToken, reservedRunAllowance, type Site } from "./core"
import { buildReport, type Manifest } from "./report"

const root = process.cwd()
const dataDir = path.join(root, "tmp/market-intelligence")
const rawDir = path.join(dataDir, "raw")
const manifestPath = path.join(dataDir, "manifest.json")
const TERMINAL = new Set(["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"])

for (const name of [".env.local", ".env"]) {
  const file = path.join(root, name)
  if (existsSync(file) && typeof process.loadEnvFile === "function") process.loadEnvFile(file)
}

async function saveManifest(manifest: Manifest): Promise<void> {
  await mkdir(dataDir, { recursive: true })
  const temporary = `${manifestPath}.tmp`
  await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
  await rename(temporary, manifestPath)
}

async function loadManifest(): Promise<Manifest | null> {
  try { return JSON.parse(await readFile(manifestPath, "utf8")) as Manifest }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  }
}

function usd(value: number): string { return `$${value.toFixed(5)}` }

async function preflight(api: ApifyApi) {
  const config = readBudgetConfig(process.env)
  const current = await api.monthlyUsage()
  const budget = assessBudget(current, current, config)
  console.log(`Apify connectivity: OK; monthly usage: ${usd(current)}; estimated remaining free credit: ${usd(budget.remainingMonthlyCredit)}.`)
  if (!budget.allowed) console.log(budget.reason)
  return { config, current, budget }
}

async function waitForRun(api: ApifyApi, run: ActorRun): Promise<ActorRun> {
  let current = run
  for (let attempt = 0; attempt < 55 && !TERMINAL.has(current.status); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 3000))
    current = await api.getRun(run.id)
  }
  if (!TERMINAL.has(current.status)) throw new Error(`Actor run ${run.id} did not reach a terminal state; no new run will start.`)
  await new Promise((resolve) => setTimeout(resolve, 10000))
  return api.getRun(run.id)
}

async function collectSite(api: ApifyApi, site: Site, manifest: Manifest): Promise<void> {
  const rawFile = path.join(rawDir, `${site.id}.json`)
  if (existsSync(rawFile)) {
    console.log(`${site.name}: local dataset exists; no Actor run started.`)
    return
  }
  let record = manifest.runs[site.id]
  let run: ActorRun
  if (record) {
    console.log(`${site.name}: resuming existing Actor run ${record.id}; no new run started.`)
    run = await api.getRun(record.id)
  } else {
    const current = await api.monthlyUsage()
    const config = readBudgetConfig(process.env)
    const budget = assessBudget(current, manifest.usageAtStartUsd, config)
    if (!budget.allowed) {
      console.log(budget.reason)
      return
    }
    const reservedUsd = Object.values(manifest.runs).reduce((sum, previous) => sum + (previous.chargeCapUsd ?? 0.12), 0)
    const chargeCapUsd = reservedRunAllowance(budget, manifest.usageAtStartUsd, config, reservedUsd)
    if (chargeCapUsd < 0.00001) {
      console.log("Apify pilot budget limit reached. No further Actor runs executed.")
      return
    }
    run = await api.startRun(actorInput(site), chargeCapUsd)
    record = { id: run.id, status: run.status, usageTotalUsd: null, datasetId: run.defaultDatasetId, malformedItems: 0, chargeCapUsd }
    manifest.runs[site.id] = record
    await saveManifest(manifest)
    console.log(`${site.name}: Actor run ${run.id} started; run charge cap ${usd(chargeCapUsd)}.`)
  }
  run = await waitForRun(api, run)
  record.status = run.status
  record.usageTotalUsd = run.usageTotalUsd
  record.datasetId = run.defaultDatasetId
  manifest.usageAfterUsd = await api.monthlyUsage()
  await saveManifest(manifest)
  ensureSucceeded(run.status)
  if (!run.defaultDatasetId) throw new Error(`Actor run ${run.id} has no dataset ID.`)
  const result = normalizeDataset(await api.datasetItems(run.defaultDatasetId), site, run.id)
  record.malformedItems = result.malformedItems
  await mkdir(rawDir, { recursive: true })
  await writeFile(rawFile, `${JSON.stringify(result.pages, null, 2)}\n`, { mode: 0o600 })
  await saveManifest(manifest)
  console.log(`${site.name}: ${result.pages.length} pages saved; ${result.malformedItems} malformed items skipped; Actor cost ${run.usageTotalUsd === null ? "not available" : usd(run.usageTotalUsd)}.`)
  if (result.pages.length === 0) console.log(`${site.name}: dynamic rendering may be required; no browser rerun will be attempted.`)
}

export async function runPilot(api: ApifyApi): Promise<void> {
  const first = await preflight(api)
  if (!first.budget.allowed) return
  let manifest = await loadManifest()
  if (!manifest) {
    manifest = { createdAt: new Date().toISOString(), usageAtStartUsd: first.current, usageAfterUsd: first.current, monthlyCreditUsd: first.config.monthlyCreditUsd, runs: {} }
    await saveManifest(manifest)
  }
  for (const site of SITES) await collectSite(api, site, manifest)
  for (const record of Object.values(manifest.runs)) {
    const latest = await api.getRun(record.id)
    record.status = latest.status
    record.usageTotalUsd = latest.usageTotalUsd
  }
  manifest.usageAfterUsd = await api.monthlyUsage()
  await saveManifest(manifest)
  const summary = await buildReport(root)
  console.log(`Pilot complete: ${summary.sites} sites, ${summary.pages} pages. Report: tools/market-intelligence/output/competitor-analysis.md`)
}

async function main(): Promise<void> {
  const command = process.argv[2]
  if (command === "analyze") {
    const summary = await buildReport(root)
    console.log(`Offline analysis generated: ${summary.sites} sites, ${summary.pages} pages; no Apify API request.`)
    return
  }
  if (command !== "preflight" && command !== "competitors") throw new Error("Use preflight, competitors, or analyze.")
  const api = createApifyApi(requireToken(process.env.APIFY_API_TOKEN))
  if (command === "preflight") await preflight(api)
  else await runPilot(api)
}

main().catch((error: unknown) => {
  // Keep API payloads and credentials out of terminal and log output.
  console.error(error instanceof Error ? error.message : "Market intelligence command failed.")
  process.exitCode = 1
})
