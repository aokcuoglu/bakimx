import { expect, test, describe } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  ACCOUNT_SETTINGS_ITEMS,
  SETTINGS_NAV_GROUPS,
  SETTINGS_TAB_REDIRECTS,
  WORKSPACE_SETTINGS_ITEMS,
} from "@/lib/settings-nav"

/**
 * #673 — Ayarlar path-based IA.
 *
 * Sekme şeridi kaldırıldı; sol nav grupları `settings-nav.ts` kaynaklı.
 * Hub `?tab=` değerlerini path'lere yönlendirir.
 */

const SETTINGS_DIR = import.meta.dir
const hubSource = readFileSync(join(SETTINGS_DIR, "page.tsx"), "utf8")
const navSource = readFileSync(join(process.cwd(), "src/lib/settings-nav.ts"), "utf8")

describe("Ayarlar hub yönlendirmesi", () => {
  test("hub SETTINGS_TAB_REDIRECTS kullanır ve varsayılan profil", () => {
    expect(hubSource).toContain("SETTINGS_TAB_REDIRECTS")
    expect(hubSource).toContain('redirect("/settings/profile")')
    expect(hubSource).not.toContain("SettingsTabs")
    expect(hubSource).not.toMatch(/<AppShell\b/)
  })

  test("eski ?tab= değerleri path'lere map edilir", () => {
    expect(SETTINGS_TAB_REDIRECTS.profile).toBe("/settings/general")
    expect(SETTINGS_TAB_REDIRECTS.team).toBe("/settings/team")
    expect(SETTINGS_TAB_REDIRECTS.branding).toBe("/settings/branding")
  })
})

describe("Ayarlar nav IA", () => {
  test("iki grup: hesap + çalışma alanı", () => {
    expect(SETTINGS_NAV_GROUPS).toHaveLength(2)
    expect(SETTINGS_NAV_GROUPS[0]?.label).toBe("Hesap ayarları")
    expect(SETTINGS_NAV_GROUPS[1]?.label).toBe("Çalışma alanı ayarları")
  })

  test("hesap öğeleri profil / paketler / faturalandırma", () => {
    expect(ACCOUNT_SETTINGS_ITEMS.map((i) => i.href)).toEqual([
      "/settings/profile",
      "/settings/plans",
      "/settings/billing",
    ])
  })

  test("çalışma alanı genel ve ekip path'leri mevcut", () => {
    const hrefs = WORKSPACE_SETTINGS_ITEMS.map((i) => i.href)
    expect(hrefs).toContain("/settings/general")
    expect(hrefs).toContain("/settings/team")
    expect(hrefs).toContain("/settings/security")
  })

  test("nav kaynağı settings-nav.ts'de tanımlı", () => {
    expect(navSource).toContain("SETTINGS_NAV_GROUPS")
    expect(navSource).toContain("ACCOUNT_SETTINGS_ITEMS")
    expect(navSource).toContain("WORKSPACE_SETTINGS_ITEMS")
  })
})
