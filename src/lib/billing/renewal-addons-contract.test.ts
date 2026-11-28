import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dir, "..", "..", "..")
const read = (path: string) => readFileSync(join(root, path), "utf8")

test("paket siparişi toplamı = paket + ek özellik kalemleri; KDV snapshot'ı toplamdan (#1049)", () => {
  const src = read("src/app/(app)/billing/actions.ts")
  expect(src).toContain("priceRenewalAddonLines(")
  expect(src).toContain("const amountMinor = packageAmountMinor + addonAmountMinor")
  expect(src).toContain("createBillingTaxSnapshot(amountMinor)")
  expect(src).toContain("addonLines.length > 0")
  expect(src.indexOf("createBillingTaxSnapshot(amountMinor)")).toBeGreaterThan(
    src.indexOf("const amountMinor = packageAmountMinor + addonAmountMinor"),
  )
})

test("referans indirimi ve yükseltme kredisi yalnız paket tutarında kalır (#1049)", () => {
  const src = read("src/app/(app)/billing/actions.ts")
  const pkg = src.slice(src.indexOf("const packageAmountMinor"), src.indexOf("const billingAccount"))
  expect(pkg).toContain("computeUpgradeAmountMinor(")
  expect(pkg).toContain("discountedAmountMinor")
  expect(pkg).not.toContain("addonLines")
})

test("yalnız hesap atölyesi kalem taşır; şube siparişi taşımaz (#1049)", () => {
  const src = read("src/app/(app)/billing/actions.ts")
  expect(src).toContain("billingAccount.isAccountWorkshop")
  expect(read("src/lib/billing/account-context.ts")).toContain("account.isAccountWorkshop ? workshop.paidAddons")
})

test("aktivasyon kalemleri aynı işlemde uygular; hakediş tabanı yalnız paket payıdır (#1049)", () => {
  const src = read("src/lib/billing/activate.ts")
  expect(src).toContain("applyAddonEntitlementsTx(")
  expect(src).toContain("commissionBaseNetMinor: createBillingTaxSnapshot(split.packageAmountMinor).netAmountMinor")
  // Paket yazımı `addons` alanına doğrudan dokunmaz (#827); yalnız kalemler uygulanır.
  const update = src.slice(src.indexOf("tx.workshop.update({"), src.indexOf("applyAddonEntitlementsTx("))
  expect(update).not.toMatch(/\baddons:/)
})

test("admin ek özelliği kapatınca paidAddons aynı işlemde güncellenir (#1049)", () => {
  expect(read("src/app/admin/actions.ts")).toContain("planPaidAddonsAfterAdminChange(")
  expect(read("src/app/admin/actions.ts")).toContain("paidAddonsRemoved")
  expect(read("scripts/workshop-admin.ts")).toContain("planPaidAddonsAfterAdminChange(")
})
