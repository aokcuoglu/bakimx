import { expect, test } from "bun:test"
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

const ROOT = join(import.meta.dir, "..", "..")
const THIS_FILE = join(import.meta.dir, "removed-feature-residue.test.ts")

const REMOVED_PATHS = [
  "src/app/(app)/market-research",
  "src/app/admin/flags",
  "src/app/api/admin/market-research",
  "src/app/api/advisor",
  "src/app/api/market-research",
  "src/app/api/orders/advisor",
  "src/app/api/parts/ai-search",
  "src/components/advisor",
  "src/components/market-research",
  "src/components/parts/ai-part-search.tsx",
  "src/lib/advisor",
  "src/lib/features.ts",
  "src/lib/market-research",
  "src/lib/parts/ai-search.ts",
  "src/lib/validations/market-research.ts",
  "scripts/activate-stage2a-pilot.ts",
]

const REMOVED_REFERENCES = [
  "market-research",
  "marketResearch",
  "MARKET_RESEARCH",
  "WorkshopFeatureOverride",
  "workshopFeatureOverride",
  "manageFlags",
  "/admin/flags",
  "resolveFeature",
  "@/lib/features",
  "aiAdvisor",
  "ai_advisor",
  "AI Servis Danışmanı",
  "AI Parça Bulucu",
  "/api/advisor",
  "AiPartSearch",
  "activate-stage2a-pilot",
]

function collectFiles(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) collectFiles(path, files)
    else if (/\.(?:ts|tsx)$/.test(entry) && path !== THIS_FILE) files.push(path)
  }
  return files
}

function pathHasFiles(path: string): boolean {
  if (!existsSync(path)) return false
  if (!statSync(path).isDirectory()) return true
  return readdirSync(path).some((entry) => pathHasFiles(join(path, entry)))
}

test("kaldırılan özelliklerin sayfa, API, bileşen ve iş mantığı yolları geri gelmez", () => {
  expect(REMOVED_PATHS.filter((path) => pathHasFiles(join(ROOT, path)))).toEqual([])
})

test("aktif kaynak ve yapılandırmada kaldırılan özelliklere referans kalmaz", () => {
  const files = [
    ...collectFiles(join(ROOT, "src")),
    ...collectFiles(join(ROOT, "scripts")),
    join(ROOT, "README.md"),
    join(ROOT, "prisma", "schema.prisma"),
    join(ROOT, ".env.example"),
    join(ROOT, ".env.local.example"),
    join(ROOT, "Dockerfile"),
    join(ROOT, ".github", "workflows", "deploy-dev-aws.yml"),
    join(ROOT, ".github", "workflows", "deploy-prod-aws.yml"),
    join(ROOT, "docs", "configuration.md"),
    join(ROOT, "docs", "operations", "platform-admin-model.md"),
    join(ROOT, "docs", "operations", "support-runbook.md"),
    join(ROOT, "docs", "architecture", "overview.md"),
    join(ROOT, "docs", "architecture", "mimari-analiz.md"),
    join(ROOT, "docs", "architecture", "bakimx-infrastructure.mmd"),
    join(ROOT, "docs", "architecture", "bakimx-modules.mmd"),
  ]
  const offenders: string[] = []

  for (const file of files) {
    const source = readFileSync(file, "utf8")
    for (const reference of REMOVED_REFERENCES) {
      if (source.includes(reference)) offenders.push(`${relative(ROOT, file)} → ${reference}`)
    }
  }

  expect(offenders).toEqual([])
})
