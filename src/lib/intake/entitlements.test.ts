import { expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { resolveIntakeEntitlements } from "@/lib/intake/entitlements"
import type { WorkshopPlanFields } from "@/lib/plan"

const DAY_MS = 86_400_000

function wsFields(over: Partial<WorkshopPlanFields> = {}): WorkshopPlanFields {
  return {
    planTier: "pro",
    subscriptionStatus: "active",
    approvalStatus: "approved",
    trialEndsAt: null,
    currentPeriodEnd: null,
    ...over,
  }
}

test("ücretli Servis Paketi: ek özellikler kapalı, paket özellikleri açık, yönetici notu görür (#828)", () => {
  expect(resolveIntakeEntitlements(wsFields(), "owner")).toEqual({
    ocrIntake: false,
    vinLookup: false,
    photoChecklist: true,
    damageMap: true,
    showAddonUpsell: true,
  })
  expect(resolveIntakeEntitlements(wsFields(), "manager").showAddonUpsell).toBe(true)
})

test("deneme sürecindeki atölyede her şey açık", () => {
  const trial = wsFields({ subscriptionStatus: "trialing", trialEndsAt: new Date(Date.now() + 5 * DAY_MS) })
  expect(resolveIntakeEntitlements(trial, "owner")).toEqual({
    ocrIntake: true,
    vinLookup: true,
    photoChecklist: true,
    damageMap: true,
    showAddonUpsell: true,
  })
})

test("süresi dolmuş deneme ek özellikleri açık tutmaz", () => {
  const expired = wsFields({ subscriptionStatus: "trialing", trialEndsAt: new Date(Date.now() - DAY_MS) })
  const e = resolveIntakeEntitlements(expired, "owner")
  expect(e.ocrIntake).toBe(false)
  expect(e.vinLookup).toBe(false)
})

test("elle verilen ek özellik profili (premium) her şeyi açar", () => {
  const e = resolveIntakeEntitlements(wsFields({ planTier: "premium" }), "owner")
  expect(e).toMatchObject({ ocrIntake: true, vinLookup: true, photoChecklist: true, damageMap: true })
})

test("eski Başlangıç satırı: ek özellikler kapalı, fotoğraf ve hasar açık", () => {
  const e = resolveIntakeEntitlements(wsFields({ planTier: "starter" }), "owner")
  expect(e).toMatchObject({ ocrIntake: false, vinLookup: false, photoChecklist: true, damageMap: true })
})

test("saha rolleri tanıtım notunu görmez; yetkiler rolden bağımsız", () => {
  for (const role of ["usta", "cirak", "staff"] as const) {
    const e = resolveIntakeEntitlements(wsFields(), role)
    expect(e.showAddonUpsell).toBe(false)
    expect(e.photoChecklist).toBe(true)
    expect(e.ocrIntake).toBe(false)
  }
  const trial = wsFields({ subscriptionStatus: "trialing", trialEndsAt: new Date(Date.now() + DAY_MS) })
  expect(resolveIntakeEntitlements(trial, "usta").vinLookup).toBe(true)
})

test("atölye satırı yoksa Servis Paketi hakları: paket açık, ek özellik kapalı", () => {
  expect(resolveIntakeEntitlements(null, "owner")).toEqual({
    ocrIntake: false,
    vinLookup: false,
    photoChecklist: true,
    damageMap: true,
    showAddonUpsell: true,
  })
})

// ——— Kaynak kapısı: kilitli ek özelliğin girişi 403'e gitmesin (#828) ———

const SRC = join(import.meta.dir, "..", "..")
const COMPONENTS = join(SRC, "components")

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (full.endsWith(".tsx")) out.push(full)
  }
  return out
}

test("kabul sihirbazı paket adı değil yetki nesnesi alır", () => {
  for (const file of ["intake-wizard.tsx", "vehicle-entry-wizard.tsx"]) {
    const source = readFileSync(join(COMPONENTS, "intake", file), "utf8")
    expect(source).not.toContain("planTier")
    expect(source).not.toContain("hasFeature(")
    expect(source).toContain("IntakeEntitlements")
  }
})

/**
 * Ek özelliğe giden giriş bileşenleri ve onları koşullayan yetki alanı. Bu
 * bileşenleri çizen her dosya ilgili yetkiyi okumak zorunda; okumuyorsa giriş
 * ücretli atölyede de görünür ve dokununca 403 metni gelir.
 */
const GATED_ENTRIES: { tag: string; entitlement: "ocrIntake" | "vinLookup" }[] = [
  { tag: "<RuhsattanOku", entitlement: "ocrIntake" },
  { tag: "<RegistrationCameraScanner", entitlement: "ocrIntake" },
  { tag: "<VinScanner", entitlement: "vinLookup" },
  { tag: "<VinResolveButton", entitlement: "vinLookup" },
]

/** Bileşenlerin kendi tanım dosyaları — onları çizmezler, tanımlarlar. */
const DEFINITION_FILES = new Set([
  "components/vehicles/ruhsattan-oku.tsx",
  "components/vehicles/vin-resolve.tsx",
  "components/intake/vin-scanner.tsx",
  "components/intake/registration-camera-scanner.tsx",
])

test("ruhsat OCR ve şase girişlerini çizen her bileşen yetkiyi okur", () => {
  const offenders: string[] = []
  let renderers = 0
  for (const file of walk(COMPONENTS)) {
    const rel = relative(SRC, file)
    if (DEFINITION_FILES.has(rel)) continue
    const source = readFileSync(file, "utf8")
    for (const { tag, entitlement } of GATED_ENTRIES) {
      if (!source.includes(tag)) continue
      renderers += 1
      if (!source.includes(entitlement)) offenders.push(`${rel}: ${tag} → ${entitlement}`)
    }
  }
  // Tarama gerçekten bir şey buluyor mu? (Yol bozulursa test boşa yeşil kalmasın.)
  expect(renderers).toBeGreaterThanOrEqual(6)
  expect(offenders).toEqual([])
})
