import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dir, "..", "..", "..")
const source = (path: string) => readFileSync(join(root, path), "utf8")

test("CRM şeması atama geçmişi, görevler ve dondurulmuş atfı kalıcılaştırır", () => {
  const schema = source("prisma/schema.prisma")
  const migration = source("prisma/migrations/20260827213000_sales_crm_tasks/migration.sql")

  expect(schema).toContain("model SalesLeadAssignment")
  expect(schema).toContain("model SalesTask")
  expect(schema).toContain("enum SalesActivityResult")
  expect(schema).toContain("attributionFrozenAt")
  expect(migration).toContain('CREATE INDEX "SalesLead_normalizedPhone_idx"')
  expect(migration).toContain('CREATE INDEX "SalesLead_normalizedEmail_idx"')
  expect(migration).toContain('CHECK ("durationMinutes" BETWEEN 5 AND 480)')
})

test("satış mutasyonları sahipliği işlem içinde yeniden doğrular", () => {
  const actions = source("src/app/admin/sales/actions.ts")

  expect(actions).toContain('getSalesAccess("manageSalesPipeline")')
  expect(actions).toContain("assertSalesLeadAccess(access, currentLead)")
  expect(actions).toContain('...(access.kind === "advisor" ? { advisorId: access.advisorId } : {})')
  expect(actions).toContain("attributionFrozenAt: occurredAt")
  expect(actions).toContain("completedByActivityId: activity.id")
})

test("aday sayfaları Next 16 promise parametreleri, sahiplik kapsamı ve sayfalama kullanır", () => {
  const listPage = source("src/app/admin/sales/leads/page.tsx")
  const detailPage = source("src/app/admin/sales/leads/[id]/page.tsx")

  expect(listPage).toContain("searchParams: Promise<")
  expect(listPage).toContain("salesLeadScope(access)")
  expect(detailPage).toContain("params: Promise<{ id: string }>")
  expect(detailPage).toContain("const { id } = await params")
  expect(detailPage).toContain("where: { id, ...salesLeadScope(access) }")
  expect(detailPage).toContain("skip: (currentActivityPage - 1) * ACTIVITY_PAGE_SIZE")
  expect(detailPage).toContain("take: ACTIVITY_PAGE_SIZE")
})
