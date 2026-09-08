import { expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
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

test("uygulama içi paket CTA yetkisi billing.manage rolünden gelir", () => {
  const page = read("src/app/(app)/billing/page.tsx")
  const purchasePage = read("src/app/(app)/billing/quota/purchase/page.tsx")
  const comparison = read("src/components/billing/plan-packages.tsx")
  expect(page).toContain("canManageBilling(user.role)")
  expect(page).toContain("canPurchase={canPurchase}")
  expect(purchasePage).toContain("canManageBilling(user.role)")
  expect(comparison).toContain("Paket değişikliği için yöneticinizle görüşün.")
  expect(purchasePage).toContain("Paket değişikliği için yöneticinizle görüşün.")
})

test("eski kota sayfası kullanıma yönlenir ve ek kota rotası korunur", () => {
  const redirectPage = read("src/app/(app)/billing/quota/page.tsx")
  expect(redirectPage).toContain('redirect("/billing#kullanim")')
  expect(existsSync(join(root, "src/app/(app)/billing/quota/purchase/page.tsx"))).toBe(true)
})

test("kullanım görünümü Lite boş durumunu gösterir ve sahte depolama yüzdesi üretmez", () => {
  const source = read("src/components/billing/usage-cards.tsx")
  expect(source.match(/Paketinizde bulunmuyor/g)?.length).toBe(2)
  expect(source.toLocaleLowerCase("tr-TR")).not.toContain("depolama yüzdesi")
  expect(source).toContain("Premium deneme hakları")
})

test("koltuk sorgusu yalnız süresi geçmemiş davetleri sayar", () => {
  const source = read("src/lib/rbac.ts")
  expect(source).toContain('status: "pending", expiresAt: { gt: new Date() }')
})
