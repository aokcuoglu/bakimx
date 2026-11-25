import { describe, expect, test } from "bun:test"
import {
  ACCOUNT_SETTINGS_ITEMS,
  WORKSPACE_SETTINGS_ITEMS,
  buildSettingsTrail,
} from "@/lib/settings-nav"

describe("buildSettingsTrail (#856)", () => {
  test("çalışma alanı sayfası: Ayarlar › grup › sayfa, geri bağlantısı yok", () => {
    expect(buildSettingsTrail("/settings/general")).toEqual({
      crumbs: [{ label: "Ayarlar" }, { label: "Çalışma alanı" }, { label: "Genel" }],
      back: null,
    })
  })

  test("kişisel sayfa", () => {
    expect(buildSettingsTrail("/settings/account").crumbs).toEqual([
      { label: "Ayarlar" },
      { label: "Kişisel" },
      { label: "Profil" },
    ])
  })

  test("matchPrefix'li öğe: /members ve /teams aynı yaprağı verir", () => {
    for (const path of ["/settings/members-and-teams/members", "/settings/members-and-teams/teams"]) {
      expect(buildSettingsTrail(path).crumbs.at(-1)).toEqual({ label: "Üyeler ve ekipler" })
    }
  })

  test("alt sayfa: üst halka bağlantı, yaprak sayfa adı, geri = üst", () => {
    expect(buildSettingsTrail("/settings/billing/record-usage")).toEqual({
      crumbs: [
        { label: "Ayarlar" },
        { label: "Çalışma alanı" },
        { label: "Faturalandırma", href: "/settings/billing" },
        { label: "Kullanımlar" },
      ],
      back: { label: "Faturalandırma", href: "/settings/billing" },
    })
    expect(buildSettingsTrail("/settings/billing/automation-credit-usage").crumbs.at(-1)).toEqual({ label: "Krediler" })
  })

  test("ekip kaydı: ad yokken zincir üst bağlantıda biter, ad gelince yaprak olur", () => {
    const path = "/settings/members-and-teams/teams/t1/members"
    const parent = { label: "Üyeler ve ekipler", href: "/settings/members-and-teams/teams" }
    const bare = buildSettingsTrail(path)
    expect(bare.crumbs.at(-1)).toEqual(parent)
    expect(bare.back).toEqual(parent)
    const named = buildSettingsTrail(path, { recordTitle: "Usta Ekibi" })
    expect(named.crumbs.slice(-2)).toEqual([parent, { label: "Usta Ekibi" }])
    expect(named.back).toEqual(parent)
  })

  test("bilinmeyen / eski yol boş zincir verir", () => {
    expect(buildSettingsTrail("/settings/team").crumbs).toEqual([])
    expect(buildSettingsTrail("/settings/profile").crumbs).toEqual([])
    expect(buildSettingsTrail("/settings").crumbs).toEqual([])
  })

  test("kayıt ile türetilir: her menü öğesinin yaprağı etiketidir", () => {
    for (const item of [...ACCOUNT_SETTINGS_ITEMS, ...WORKSPACE_SETTINGS_ITEMS]) {
      const { crumbs, back } = buildSettingsTrail(item.href)
      expect(crumbs.at(-1)).toEqual({ label: item.label })
      expect(crumbs).toHaveLength(3)
      expect(back).toBeNull()
    }
  })
})
