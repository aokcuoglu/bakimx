import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const ROOT = join(import.meta.dir, "..", "..", "..")
const read = (path: string) => readFileSync(join(ROOT, path), "utf8")

/**
 * Admin ve satış ekranları paket adını `@/lib/plan`'dan (`PLAN_LABELS` /
 * `planLabel`) okur. Yerel etiket haritaları tek pakete geçişten (#782) sonra
 * "Profesyonel" / "Premium" gibi emekli adları göstermeye devam etmişti (#830).
 */
const LABEL_SURFACES = [
  "src/app/admin/admin-workshops.tsx",
  "src/app/admin/admin-billing.tsx",
  "src/app/admin/workshops/[id]/page.tsx",
  "src/app/admin/workshop-detail-filters.tsx",
  "src/app/admin/workshop-actions.tsx",
  "src/components/sales/commission-ledger.tsx",
  "src/components/sales/commission-rule-settings.tsx",
]

describe("admin ve satış paket etiketleri tek kaynaktan gelir (#830)", () => {
  test.each(LABEL_SURFACES)("%s emekli paket adı ve yerel etiket haritası taşımaz", (path) => {
    const source = read(path)
    expect(source).not.toContain('"Profesyonel"')
    expect(source).not.toMatch(/const\s+(?:TIER_LABELS|PLAN_LABELS)\b/)
    expect(source).toMatch(/\b(?:PLAN_LABELS|planLabel)\b/)
  })

  test("elle etkinleştirme paket seçtirmez; premium yalnız ek özellik anahtarlarıyla açılır", () => {
    const source = read("src/app/admin/workshop-actions.tsx")
    expect(source).not.toContain("premium")
    expect(source).not.toContain("setTier")
    expect(source).toContain('const MANUAL_ACTIVATION_TIER = "pro" as const')
    expect(source).toContain("activateWorkshopPlan(w.id, MANUAL_ACTIVATION_TIER")
    // Koltuk sayısı PLAN_SEATS / erişim profilinden gelir, sabit harita değil.
    expect(source).not.toMatch(/starter:\s*\d/)
    expect(source).toContain("PLAN_SEATS")
    // Dahil koltuk iki çağırandan da gelir; tahmini fallback yok.
    expect(source).toContain("includedSeats: number")
    expect(source).toContain("lifetimeLite: boolean")
  })

  test("eski satırda uyarı belirgin, düğme hedefi söyler, süresiz Lite kaybı yazılır", () => {
    const source = read("src/app/admin/workshop-actions.tsx")
    expect(source).toContain('" Süresiz Lite hakkı kalkar."')
    expect(source).toContain('<p className="font-normal text-foreground">{legacyNote}</p>')
    expect(source).toContain("`${manualLabel}'ne geçir`")
    // Gri (bg-muted) kutudaki notlar düz muted ton taşımaz (~4.05:1).
    expect(source).not.toContain('<p className="text-muted-foreground">')
    expect(source).toContain('<p className="text-muted-foreground-strong">')
  })

  test("activateWorkshopPlan yalnız satıştaki paketi kabul eder", () => {
    const source = read("src/app/admin/actions.ts")
    expect(source).toContain("if (!isSalePlanTier(tier))")
    // Önceki paket ve süresiz Lite izi denetim kaydına yazılır.
    expect(source).toContain('JSON.stringify(planActivationAuditMetadata(current, tier, "active", period))')
    // Dönem ya da açık süresiz seçimi sunucuda doğrulanır ve yazılır (#1040).
    expect(source).toContain("manualPlanActivationSchema.safeParse(")
    expect(source).toContain("billingCycle: period.billingCycle")
    expect(source).toContain("currentPeriodEnd: period.currentPeriodEnd")
    expect(source).toContain("dönem ortasında değiştirilemez")
    expect(source).not.toMatch(/const\s+TIERS\b/)
  })
})
