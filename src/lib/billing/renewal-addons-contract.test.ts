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

test("yenileme kalemleri süzülmüş anahtarlardan gelir; sunucu ve istemci aynı yardımcıyı kullanır (#1049)", () => {
  for (const path of [
    "src/app/(app)/billing/actions.ts",
    "src/lib/billing/account-context.ts",
    "src/app/checkout/page.tsx",
  ]) {
    expect(read(path)).toContain("effectivePaidAddonKeys(")
  }
})

// Davranış testleri: activate.test.ts (kalemler + hakediş tabanı), apply-addons.test.ts (kilit sırası).
test("admin ek özellik yazımı tek interaktif transaction'da yapılır (#1049)", () => {
  expect(read("src/app/admin/actions.ts")).toContain("applyAdminAddonsTx(")
  expect(read("scripts/workshop-admin.ts")).toContain("applyAdminAddonsTx(")
})
