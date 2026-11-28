import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dir, "..", "..", "..")
const read = (path: string) => readFileSync(join(root, path), "utf8")

function actionBody(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}(`)
  expect(start).toBeGreaterThan(-1)
  const next = source.indexOf("\nexport async function ", start + 1)
  return source.slice(start, next === -1 ? undefined : next)
}

test("self-serve paket etkinleştirmesi atölyenin addons alanına yazmaz (#827)", () => {
  const code = read("src/lib/billing/activate.ts")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n")
  expect(code).not.toMatch(/\baddons\b\s*[:,]/)
})

test("admin ek özellik ve ek kota eylemleri yetki kapısı ve denetim kaydı taşır (#827)", () => {
  const actions = read("src/app/admin/actions.ts")
  const quota = actionBody(actions, "setWorkshopExtraVinQuota")
  expect(quota).toContain('requireAdminCapability("manageWorkshops")')
  expect(quota).toContain("AuditLogAction")
  expect(quota).toContain("admin_extra_vin_quota_set")
  expect(quota).toContain('kind: "customer"')

  // Ek özellik yazımı (#1049'dan beri) ortak transaction yardımcısındadır; denetim kaydı orada.
  const addons = actionBody(actions, "setWorkshopAddons")
  expect(addons).toContain('requireAdminCapability("manageWorkshops")')
  expect(addons).toContain("applyAdminAddonsTx")
  const helper = read("src/lib/admin/apply-addons.ts")
  expect(helper).toContain("admin_addons_set")
  expect(helper).toContain("auditLog.create")
  expect(helper).toContain('kind: "customer"')
})

test("bağımsız ek kota satın alma rotası fiyat ve Satın Al içermez, kullanıma yönlenir (#827)", () => {
  const page = read("src/app/(app)/billing/quota/purchase/page.tsx")
  expect(page).not.toContain("₺")
  expect(page).not.toContain("Satın Al")
  expect(page).toContain('redirect("/settings/billing#kullanim")')
})
