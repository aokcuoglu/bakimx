import { expect, test } from "bun:test"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { resolveIntakeEntitlements, type IntakeEntitlements } from "@/lib/intake/entitlements"
import { hasWorkshopFeature, type WorkshopEntitlementFields } from "@/lib/plan"

const DAY_MS = 86_400_000

function wsFields(over: Partial<WorkshopEntitlementFields> = {}): WorkshopEntitlementFields {
  return {
    planTier: "pro",
    subscriptionStatus: "active",
    approvalStatus: "approved",
    trialEndsAt: null,
    currentPeriodEnd: null,
    addons: [],
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

test("eski Lite satırı: ek özellikler de paket özellikleri de kapalı", () => {
  expect(resolveIntakeEntitlements(wsFields({ planTier: "lite" }), "owner")).toEqual({
    ocrIntake: false,
    vinLookup: false,
    photoChecklist: false,
    damageMap: false,
    showAddonUpsell: true,
  })
})

test("premium + past_due: özellik kapısı sunucuyla aynı; erişim kilidi ayrı katman", () => {
  // Ödemesi gecikmiş atölye (app)/layout'taki ödeme duvarına düşer ve her
  // yazma/OCR/şase isteği önce `assertWritableOr403` ile reddedilir. Özellik
  // kapısı (`hasWorkshopFeature`) ise kayıtlı profile bakar — burada da aynısı.
  const ws = wsFields({ planTier: "premium", subscriptionStatus: "past_due" })
  expect(resolveIntakeEntitlements(ws, "owner")).toMatchObject({
    ocrIntake: true,
    vinLookup: true,
    photoChecklist: true,
    damageMap: true,
  })
})

test("atölye bazında açılmış ek özellik yalnız onu açar (#827)", () => {
  const e = resolveIntakeEntitlements(wsFields({ addons: ["ocrIntake"] }), "owner")
  expect(e.ocrIntake).toBe(true)
  expect(e.vinLookup).toBe(false)
  expect(resolveIntakeEntitlements(wsFields({ addons: ["vinLookup"] }), "owner").vinLookup).toBe(true)
})

test("istemci yetkisi her profilde sunucu özellik kapısıyla birebir aynı", () => {
  const future = new Date(Date.now() + 3 * DAY_MS)
  const past = new Date(Date.now() - DAY_MS)
  const cases: WorkshopEntitlementFields[] = [
    wsFields(),
    wsFields({ planTier: "lite" }),
    wsFields({ planTier: "starter" }),
    wsFields({ planTier: "premium" }),
    wsFields({ planTier: "premium", subscriptionStatus: "past_due" }),
    wsFields({ subscriptionStatus: "trialing", trialEndsAt: future }),
    wsFields({ subscriptionStatus: "trialing", trialEndsAt: past }),
    wsFields({ currentPeriodEnd: past }),
    wsFields({ addons: ["ocrIntake"] }),
    wsFields({ addons: ["vinLookup", "partsCatalog"] }),
    wsFields({ planTier: "lite", addons: ["vinLookup"] }),
    wsFields({ subscriptionStatus: "trialing", trialEndsAt: past, addons: ["ocrIntake"] }),
    wsFields({ addons: ["bilinmeyen"] }),
  ]
  const features = ["ocrIntake", "vinLookup", "photoChecklist", "damageMap"] as const satisfies readonly (keyof IntakeEntitlements)[]
  for (const ws of cases) {
    const e = resolveIntakeEntitlements(ws, "owner")
    for (const feature of features) expect(e[feature]).toBe(hasWorkshopFeature(ws, feature))
  }
})

// ——— Kaynak kapısı: kilitli ek özelliğin girişi 403'e gitmesin (#828) ———

const SRC = join(import.meta.dir, "..", "..")
const COMPONENTS = join(SRC, "components")

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (full.endsWith(".tsx") || (full.endsWith(".ts") && !full.endsWith(".test.ts"))) out.push(full)
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

type Entitlement = "ocrIntake" | "vinLookup"

/**
 * Çağrı yeri kapısı: ek özelliğe giden giriş (bileşen ya da otomatik sorgu)
 * her geçtiği yerde, üstündeki `window` satır içinde yetkiyi okumalı.
 * Dosyanın başka bir yerinde yetkinin geçmesi yetmez — en kolay gerileme,
 * korumalı bir dosyaya korumasız yeni bir `vinResolve.resolve(` eklemektir;
 * bu yüzden otomatik sorguda pencere dar. Koruma uzaksa onu çağrıya yaklaştır
 * (ya da çağrıyı yetkiyi okuyan küçük bir fonksiyona al, bkz. `resolveVin`).
 * JSX'te koşul ile etiket arasına kardeş öğeler girebildiği için pencere geniş.
 */
const CALL_SITES: { token: string; entitlement: Entitlement; window: number }[] = [
  { token: "<RuhsattanOku", entitlement: "ocrIntake", window: 15 },
  { token: "<RegistrationCameraScanner", entitlement: "ocrIntake", window: 15 },
  { token: "<VinScanner", entitlement: "vinLookup", window: 15 },
  { token: "<VinResolveButton", entitlement: "vinLookup", window: 15 },
  { token: "vinResolve.resolve(", entitlement: "vinLookup", window: 6 },
]

/** Dosya kapısı: bu girdiyi içeren dosya yetkiyi okumak zorunda. */
const FILE_LEVEL: { token: string; entitlement: Entitlement }[] = [
  { token: "useVinResolve(", entitlement: "vinLookup" },
  { token: "/api/vin/resolve", entitlement: "vinLookup" },
  { token: "/api/vin/scan", entitlement: "vinLookup" },
  { token: "/api/smart-capture/ocr", entitlement: "ocrIntake" },
]

/** Bilinçli istisnalar — gerekçesiz ekleme yapma; kapıyı gevşetmek yerine çağıranı koru. */
const ALLOWLIST: Record<string, string> = {
  "components/vehicles/ruhsattan-oku.tsx": "RuhsattanOku'nun tanımı; çizen her yer ocrIntake ile korunuyor",
  "components/vehicles/vin-resolve.tsx": "useVinResolve / performVinResolve / VinResolveButton tanımı",
  "components/intake/vin-scanner.tsx": "VinScanner'ın tanımı; çizen her yer vinLookup ile korunuyor",
  "components/intake/registration-camera-scanner.tsx": "RegistrationCameraScanner'ın tanımı",
  "components/intake/smart-capture-registration.tsx":
    "yalnız /smart-capture/registration'da çizilir; sayfa getFeaturePaywall(\"ocrIntake\") ile kilitli",
}

test("istisna listesindeki her dosya hâlâ var (bayat istisna kalmasın)", () => {
  for (const rel of Object.keys(ALLOWLIST)) {
    expect(statSync(join(SRC, rel)).isFile()).toBe(true)
  }
})

test("ruhsat OCR ve şase girişleri her çağrı yerinde yetkiyi okur", () => {
  const offenders: string[] = []
  let hits = 0
  for (const file of walk(COMPONENTS)) {
    const rel = relative(SRC, file)
    if (rel in ALLOWLIST) continue
    const lines = readFileSync(file, "utf8").split("\n")
    lines.forEach((line, i) => {
      for (const { token, entitlement, window } of CALL_SITES) {
        if (!line.includes(token)) continue
        hits += 1
        const above = lines.slice(Math.max(0, i - window), i + 1).join("\n")
        if (!above.includes(entitlement)) {
          offenders.push(`${rel}:${i + 1} ${token} — üstteki ${window} satırda ${entitlement} okunmuyor`)
        }
      }
    })
  }
  // Tarama gerçekten bir şey buluyor mu? (Yol bozulursa test boşa yeşil kalmasın.)
  expect(hits).toBeGreaterThanOrEqual(12)
  expect(offenders).toEqual([])
})

test("ek özellik uç noktasına giden ya da sorgu kancasını kuran dosya yetkiyi okur", () => {
  const offenders: string[] = []
  let hits = 0
  for (const file of walk(COMPONENTS)) {
    const rel = relative(SRC, file)
    if (rel in ALLOWLIST) continue
    const source = readFileSync(file, "utf8")
    for (const { token, entitlement } of FILE_LEVEL) {
      if (!source.includes(token)) continue
      hits += 1
      if (!source.includes(entitlement)) offenders.push(`${rel}: ${token} → ${entitlement}`)
    }
  }
  expect(hits).toBeGreaterThanOrEqual(3)
  expect(offenders).toEqual([])
})
