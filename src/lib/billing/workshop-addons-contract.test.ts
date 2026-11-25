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
  for (const [name, auditKey] of [
    ["setWorkshopAddons", "admin_addons_set"],
    ["setWorkshopExtraVinQuota", "admin_extra_vin_quota_set"],
  ] as const) {
    const body = actionBody(actions, name)
    expect(body).toContain('requireAdminCapability("manageWorkshops")')
    expect(body).toContain("AuditLogAction")
    expect(body).toContain(auditKey)
    expect(body).toContain('kind: "customer"')
  }
})

test("bağımsız ek kota satın alma rotası fiyat ve Satın Al içermez, kullanıma yönlenir (#827)", () => {
  const page = read("src/app/(app)/billing/quota/purchase/page.tsx")
  expect(page).not.toContain("₺")
  expect(page).not.toContain("Satın Al")
  expect(page).toContain('redirect("/settings/billing#kullanim")')
})
