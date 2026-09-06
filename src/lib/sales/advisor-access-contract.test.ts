import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dir, "..", "..", "..")
const source = (path: string) => readFileSync(join(root, path), "utf8")

test("şema ve migration iç tenant ile tek kullanımlık daveti birlikte kurar", () => {
  const schema = source("prisma/schema.prisma")
  const migration = source("prisma/migrations/20260827190000_sales_advisor_access/migration.sql")

  expect(schema).toContain("enum WorkshopKind")
  expect(schema).toContain("model SalesAdvisorInvite")
  expect(schema).toContain("sessionsValidFrom")
  expect(migration).toContain('CREATE UNIQUE INDEX "Workshop_single_internal_kind"')
  expect(migration).toContain("WHERE \"kind\" = 'internal'")
  expect(migration).toContain("BakımX İç Operasyon")
})

test("middleware satış yüzeyini tenant sayfa ve API'lerinden ayırır", () => {
  const middleware = source("src/middleware.ts")
  expect(middleware).toContain('session.surface === "sales"')
  expect(middleware.match(/session\.surface !== "sales" && isTechnicianRestrictedRole/g)).toHaveLength(2)
  expect(middleware).toContain("isRouteAllowedForSalesSurface(pathname)")
  expect(middleware).toContain("Satış hesabı iş yeri API'lerine erişemez")
})

test("müşteri raporlarının ortak sorguları workshop kind filtresi taşır", () => {
  expect(source("src/lib/admin-workshop-filters.ts")).toContain('kind: "customer"')
  expect(source("src/app/admin/data.ts")).toContain('kind: "customer"')
  expect(source("src/lib/billing/lifecycle.ts")).toContain('kind: "customer"')
  expect(source("src/app/admin/workshops/[id]/page.tsx")).toContain('where: { id, kind: "customer" }')
})
