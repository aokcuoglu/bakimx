import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const querySource = readFileSync(join(import.meta.dir, "performance-query.ts"), "utf8")
const pageSource = readFileSync(join(import.meta.dir, "../../app/admin/sales/performance/page.tsx"), "utf8")
const actionSource = readFileSync(join(import.meta.dir, "../../app/admin/sales/performance/actions.ts"), "utf8")

test("performans sorgusu rol kapsamını bütün CRM ve ledger okumalarına taşır", () => {
  expect(querySource).toContain('access.kind === "advisor" ? { id: access.advisorId')
  expect(querySource).toContain("advisorId: { in: advisorIds }")
  expect(querySource).toContain("{ lead: { advisorId: { in: advisorIds } } }")
  expect(querySource).toContain("{ createdBy: { salesAdvisor: { id: { in: advisorIds } } } }")
  expect(querySource).toContain("billingOrder: { confirmedAt: range }")
})

test("dönem kolonları doğru olay zamanını ve ledger snapshot bazını kullanır", () => {
  expect(querySource).toContain("createdAt: range")
  expect(querySource).toContain("occurredAt: range")
  expect(querySource).toContain("usedAt: range")
  expect(querySource).toContain("workshopId: { not: null }")
  expect(querySource).toContain("calculationBaseMinor: true")
  expect(querySource).toContain("confirmedAt: commission.billingOrder.confirmedAt")
})

test("performans sayfası Next 16 searchParams Promise sözleşmesini uygular", () => {
  expect(pageSource).toContain("searchParams: Promise<")
  expect(pageSource).toContain("await searchParams")
  expect(pageSource).toContain('getSalesAccess("viewSales")')
})

test("hedef yazımı kurucu yeteneği, etkin danışman ve ay tekilliğiyle korunur", () => {
  expect(actionSource).toContain('getSalesAccess("manageSalesAdvisors")')
  expect(actionSource).toContain("disabledAt: null")
  expect(actionSource).toContain("advisorId_monthStart")
  expect(actionSource).toContain("setById: access.userId")
})
