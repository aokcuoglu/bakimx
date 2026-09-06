import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dir, "../../..")
const migration = readFileSync(join(root, "prisma/migrations/20260828213000_sales_performance_targets/migration.sql"), "utf8")
const resetScript = readFileSync(join(root, "scripts/prod-reset.ts"), "utf8")

test("aylık hedef migration'ı tekillik, pozitif değer ve ilişki bütünlüğünü DB'de korur", () => {
  expect(migration).toContain('CREATE TABLE "SalesAdvisorMonthlyTarget"')
  expect(migration).toContain('"SalesAdvisorMonthlyTarget_advisorId_monthStart_key"')
  expect(migration).toContain('CONSTRAINT "SalesAdvisorMonthlyTarget_nonnegative_check"')
  expect(migration).toContain('REFERENCES "SalesAdvisor"("id") ON DELETE CASCADE')
  expect(migration).toContain('REFERENCES "User"("id") ON DELETE RESTRICT')
})

test("tenant reset aylık hedef tablosunu FK güvenli truncate kapsamına alır", () => {
  expect(resetScript).toContain('"SalesAdvisorMonthlyTarget"')
})
