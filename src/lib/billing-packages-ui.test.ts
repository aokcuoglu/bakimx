import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), "utf8")

test("paket karşılaştırması masaüstü semantik tablo ve mobil shadcn Tabs kullanır", () => {
  const source = read("src/components/billing/plan-packages.tsx")
  expect(source).toContain("<Table")
  expect(source).toContain('scope="col"')
  expect(source).toContain('scope="row"')
  expect(source).toContain("<Tabs")
  expect(source).toContain("<TabsTrigger")
  expect(source).not.toContain("framer-motion")
})

test("uygulama içi paket CTA etkin billing.manage izninden gelir", () => {
  const page = read("src/app/(app)/settings/plans/page.tsx")
  const context = read("src/lib/billing/account-context.ts")
  const comparison = read("src/components/billing/plan-packages.tsx")
  expect(context).toContain('actorCan(user, "billing.manage")')
  expect(context).toContain('isTechnicianRestrictedRole(user.role)')
  expect(page).toContain("canPurchase={canPurchase}")
  expect(comparison).toContain("Paket değişikliği için yöneticinizle görüşün.")
})

test("eski kota sayfası ve ek kota satın alma rotası kullanıma yönlenir (#827)", () => {
  const redirectPage = read("src/app/(app)/billing/quota/page.tsx")
  expect(redirectPage).toContain('redirect("/settings/billing#kullanim")')
  const purchasePage = read("src/app/(app)/billing/quota/purchase/page.tsx")
  expect(purchasePage).toContain('redirect("/settings/billing#kullanim")')
})

test("faturalandırma kullanımı gerçek hakları ve Lite boş durumunu gösterir", () => {
  const source = read("src/components/billing/billing-usage-panel.tsx")
  expect(source).toContain("Paketinizde bulunmuyor")
  expect(source.toLocaleLowerCase("tr-TR")).not.toContain("depolama yüzdesi")
  expect(source).toContain("plan.includedSeats")
  expect(source).toContain("quota.used")
})

test("koltuk sorgusu yalnız süresi geçmemiş davetleri sayar", () => {
  const source = read("src/lib/rbac.ts")
  expect(source).toContain('status: "pending", expiresAt: { gt: new Date() }')
})

test("paket kartı dönem seçicisi ortak BillingCycleToggle'dır ve yüksekliği ezmez (#846)", () => {
  const source = read("src/components/billing/plan-packages.tsx")
  expect(source).not.toContain("h-7!")
  expect(source).toContain("BillingCycleToggle")
  const toggle = read("src/components/billing/billing-cycle-toggle.tsx")
  expect(toggle).toContain('size="control"')
  expect(toggle).not.toContain("framer-motion")
})

test("ayarlar paket şeridi dönemi belli değilken aylık liste fiyatını gösterir (#846)", () => {
  const source = read("src/components/billing/plan-packages.tsx")
  expect(source).toContain('const stripPriceCycle: BillingCycle = hasCommittedCycle ? stripCycle : "monthly"')
  expect(source).toContain("monthlyEquivalent(currentPkg.tier, stripPriceCycle)")
  expect(source).not.toContain("monthlyEquivalent(currentPkg.tier, stripCycle)")
})

test("ek özellik satırı durumu yalnız ayarlar sayfasından iner (#879)", () => {
  const page = read("src/app/(app)/settings/plans/page.tsx")
  expect(page).toContain("resolveAddonRowViews(workshop, { isAccountWorkshop })")
  expect(page).toContain("addonViews=")
  expect(read("src/app/(site)/fiyatlar/page.tsx")).not.toContain("addonViews")
  expect(read("src/components/billing/plan-locked.tsx")).not.toContain("addonViews")
  const source = read("src/components/billing/plan-packages.tsx")
  expect(source).toContain("renderAction")
  expect(source).toContain('"bg-success/10 text-success-strong"')
  for (const label of ["Etkin", "Denemede açık", "Kısmen etkin"]) expect(source).toContain(label)
})
