import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import path from "node:path"

const root = path.join(import.meta.dir, "../../..")
const script = readFileSync(path.join(root, "scripts/audit-sales-rollout.ts"), "utf8")

test("rollout denetim CLI'ı yalnız okuma sorguları kullanır", () => {
  expect(script).toContain("salesAdvisor.findMany")
  expect(script).toContain("salesLead.findMany")
  expect(script).toContain("billingOrder.findMany")
  expect(script).toContain("salesCommission.findMany")
  expect(script).not.toMatch(/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/)
  expect(script).not.toContain("$executeRaw")
  expect(script).not.toContain("$queryRawUnsafe")
})

test("CLI açık kategori ve kimlikli JSON çıktısı sunar", () => {
  expect(script).toContain('args.has("--json")')
  expect(script).toContain('args.has("--fail-on-findings")')
  expect(script).toContain("finding.entity")
  expect(script).toContain("finding.id")
})
