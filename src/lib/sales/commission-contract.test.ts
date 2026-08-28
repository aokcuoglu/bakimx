import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dir, "..", "..", "..")
const source = (path: string) => readFileSync(join(root, path), "utf8")

describe("sales commission migration and integration contract", () => {
  const migration = source("prisma/migrations/20260828210000_sales_commission_ledger/migration.sql")

  it("BillingOrder için %20 KDV brüt/net snapshot'ını geri doldurur", () => {
    expect(migration).toContain('"vatRateBps" = 2000')
    expect(migration).toContain('"grossAmountMinor" = "amountMinor"')
    expect(migration).toContain('ROUND("amountMinor"::numeric * 10000 / 12000)::integer')
    expect(migration).toContain('ALTER COLUMN "netAmountMinor" SET NOT NULL')
    expect(migration).toContain('CREATE TRIGGER "BillingOrder_fill_tax_snapshot"')
  })

  it("mevcut manuel hakediş tutarına dokunmadan legacy inceleme ve olay kaydı açar", () => {
    expect(migration).toContain('SET "reviewReason" = \'legacy_manual\'')
    expect(migration).toContain("'legacy_backfill'")
    expect(migration).not.toContain('SET "amountMinor" =')
  })

  it("append-only kural ve aktörlü ledger olay tablolarını oluşturur", () => {
    expect(migration).toContain('CREATE TABLE "SalesCommissionRule"')
    expect(migration).toContain('CREATE TABLE "SalesCommissionEvent"')
    expect(migration).toContain('"actorId" TEXT')
    expect(migration).toContain('"fromStatus" "SalesCommissionStatus"')
    expect(migration).toContain('"toStatus" "SalesCommissionStatus" NOT NULL')
  })
})

describe("sales commission authorization and snapshot contract", () => {
  it("ödeme aktivasyonu ledger taslağını aynı transaction içinde oluşturur", () => {
    const activate = source("src/lib/billing/activate.ts")
    const transactionStart = activate.indexOf("await prisma.$transaction")
    const commissionCall = activate.indexOf("await createCommissionDraftForBillingOrderTx")
    const transactionEnd = activate.indexOf("await AuditLogAction")
    expect(transactionStart).toBeGreaterThan(-1)
    expect(commissionCall).toBeGreaterThan(transactionStart)
    expect(commissionCall).toBeLessThan(transactionEnd)
  })

  it("iki sipariş oluşturma yolu da KDV snapshot'ını sunucuda üretir", () => {
    expect(source("src/app/(app)/billing/actions.ts")).toContain("createBillingTaxSnapshot(amountMinor)")
    expect(source("src/app/api/checkout/route.ts")).toContain("createBillingTaxSnapshot(amountMinor)")
  })

  it("danışman ledger sorgusunu yalnız kendi advisorId değeriyle görür", () => {
    const page = source("src/app/admin/sales/commissions/page.tsx")
    expect(page).toContain('getSalesAccess("viewSalesCommissions")')
    expect(page).toContain('access.kind === "advisor" ? { advisorId: access.advisorId } : {}')
    expect(page).toContain("searchParams: Promise<")
  })

  it("yönetim action'ları manage yeteneğini yeniden doğrular ve kural değişimi geçmiş ledger'a yazmaz", () => {
    const actions = source("src/app/admin/sales/commissions/actions.ts")
    const settings = source("src/app/admin/sales/settings/actions.ts")
    expect(actions.match(/getSalesAccess\("manageSalesCommissions"\)/g)?.length).toBe(3)
    expect(settings).toContain('getSalesAccess("manageSalesCommissions")')
    expect(settings).toContain("salesCommissionRule.updateMany")
    expect(settings).not.toContain("salesCommission.update")
  })
})
