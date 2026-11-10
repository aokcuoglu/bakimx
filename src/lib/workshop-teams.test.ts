import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { actorCan, parsePermissions } from "@/lib/roles"
import { canSeedDefaultTeams } from "@/lib/workshop-teams"

const source = (path: string) => readFileSync(join(import.meta.dir, "../..", path), "utf8")

/** `export async function <name>(…) { … }` gövdesi — bir sonraki `export`a kadar. */
function functionBody(file: string, name: string): string {
  const start = file.indexOf(`export async function ${name}(`)
  if (start === -1) throw new Error(`${name} bulunamadı`)
  const next = file.indexOf("\nexport ", start + 1)
  return file.slice(start, next === -1 ? undefined : next)
}

describe("ekip izinleri", () => {
  test("sahip ekip listesinden bağımsız tam yetkilidir", () => {
    expect(actorCan({ role: "owner", teamPermissions: [] }, "billing.manage")).toBe(true)
  })

  test("ekip atanmış üyede kutu listesi geçerlidir", () => {
    expect(
      actorCan({ role: "cirak", teamPermissions: ["order.edit"] }, "order.edit"),
    ).toBe(true)
    expect(
      actorCan({ role: "usta", teamPermissions: ["order.edit"] }, "parts.purchase"),
    ).toBe(false)
  })

  test("ekip yoksa statik rol matrisi durur", () => {
    expect(actorCan({ role: "cirak", teamPermissions: null }, "parts.purchase")).toBe(true)
    expect(actorCan({ role: "cirak", teamPermissions: null }, "order.edit")).toBe(false)
  })

  test("bilinmeyen anahtarlar yok sayılır", () => {
    expect(parsePermissions(["order.edit", "nope"])).toEqual(["order.edit"])
  })
})

describe("varsayılan ekip oluşturma yazma yolu (#736)", () => {
  test("listWorkshopTeams salt okunurdur", () => {
    const body = functionBody(source("src/lib/workshop-teams.ts"), "listWorkshopTeams")
    expect(body).not.toMatch(/ensureWorkshopTeams|createMany|updateMany|\.create\(|\.update\(|\.upsert\(/)
  })

  test("yalnız ekip yönetebilen ve salt-okunur taklitte olmayan aktör oluşturabilir", () => {
    expect(canSeedDefaultTeams({ role: "owner" })).toBe(true)
    expect(canSeedDefaultTeams({ role: "manager" })).toBe(true)
    expect(canSeedDefaultTeams({ role: "owner", impersonationReadOnly: true })).toBe(false)
    expect(canSeedDefaultTeams({ role: "usta" })).toBe(false)
    expect(canSeedDefaultTeams({ role: "cirak" })).toBe(false)
    // Ekip izni statik rolün önüne geçer: team.manage verilmemiş yönetici oluşturamaz.
    expect(canSeedDefaultTeams({ role: "manager", teamPermissions: ["order.edit"] })).toBe(false)
    expect(canSeedDefaultTeams({ role: "usta", teamPermissions: ["team.manage"] })).toBe(true)
  })

  test("ayar sayfaları yetki kapılı yükleyiciyi kullanır, ham ensure çağırmaz", () => {
    for (const page of [
      "src/app/(app)/settings/members-and-teams/members/page.tsx",
      "src/app/(app)/settings/members-and-teams/teams/page.tsx",
    ]) {
      const file = source(page)
      expect(file).toContain("loadWorkshopTeamsForSettings(user)")
      expect(file).not.toContain("ensureWorkshopTeams")
    }
  })

  test("üyeler sayfası ekipleri üye listesinden ÖNCE hazırlar", () => {
    const file = source("src/app/(app)/settings/members-and-teams/members/page.tsx")
    const teamsAt = file.indexOf("await loadWorkshopTeamsForSettings(user)")
    const membersAt = file.indexOf("prisma.user.findMany")
    expect(teamsAt).toBeGreaterThan(-1)
    expect(membersAt).toBeGreaterThan(teamsAt)
    // Ekip yükleyicisi üyelerle aynı Promise.all içinde koşmamalı.
    const parallel = file.slice(file.indexOf("Promise.all([", teamsAt))
    expect(parallel.slice(0, parallel.indexOf("])"))).not.toContain("loadWorkshopTeamsForSettings")
  })
})

