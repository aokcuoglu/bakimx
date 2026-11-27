import { expect, test } from "bun:test"
import { parseAuditMetadata } from "./audit-metadata"
import { planActivationAuditMetadata } from "./plan-activation-audit"

const MONTHLY = { billingCycle: "monthly", currentPeriodEnd: new Date("2026-12-27T10:00:00Z") }
const INDEFINITE = { billingCycle: null, currentPeriodEnd: null }

test("elle etkinleştirme kaydı önceki paketi ve durumu taşır (#830)", () => {
  expect(planActivationAuditMetadata({ planTier: "premium", subscriptionStatus: "trialing", liteFreeGrantedAt: null }, "pro", "active", MONTHLY)).toEqual({
    tier: "pro",
    status: "active",
    previousTier: "premium",
    previousStatus: "trialing",
    cycle: "monthly",
    periodEndsAt: "2026-12-27T10:00:00.000Z",
  })
})

test("ezilen süresiz Lite hakkı kayda işlenir", () => {
  const metadata = planActivationAuditMetadata({ planTier: "lite", subscriptionStatus: "active", liteFreeGrantedAt: new Date("2026-09-08T00:00:00Z") }, "pro", "active", MONTHLY)
  expect(metadata).toEqual({ tier: "pro", status: "active", previousTier: "lite", previousStatus: "active", hadLifetimeLite: true, cycle: "monthly", periodEndsAt: "2026-12-27T10:00:00.000Z" })
  // Damga yalnız paket hâlâ `lite` iken haktır.
  expect(planActivationAuditMetadata({ planTier: "starter", subscriptionStatus: "active", liteFreeGrantedAt: new Date() }, "pro", "active", MONTHLY)).not.toHaveProperty("hadLifetimeLite")
})

test("denetim ekranı paket alanlarını okunur adla gösterir", () => {
  const parsed = parseAuditMetadata(JSON.stringify(planActivationAuditMetadata({ planTier: "lite", subscriptionStatus: "active", liteFreeGrantedAt: new Date() }, "pro", "active", MONTHLY)))
  expect(parsed.details).toEqual([
    { key: "tier", label: "Paket", value: "Servis Paketi" },
    { key: "status", label: "Durum", value: "Aktif" },
    { key: "previousTier", label: "Önceki paket", value: "Lite (eski)" },
    { key: "previousStatus", label: "Önceki durum", value: "Aktif" },
    { key: "hadLifetimeLite", label: "Süresiz Lite hakkı vardı", value: "Evet" },
    { key: "cycle", label: "Dönem", value: "Aylık" },
    { key: "periodEndsAt", label: "Dönem bitişi", value: expect.any(String) },
  ])
})

test("süresiz seçim denetim kaydına açıkça işlenir, dönem anahtarı yazılmaz (#1040)", () => {
  const metadata = planActivationAuditMetadata({ planTier: "pro", subscriptionStatus: "trialing" }, "pro", "active", INDEFINITE)
  expect(metadata).toEqual({ tier: "pro", status: "active", previousTier: "pro", previousStatus: "trialing", indefinite: true })
  const parsed = parseAuditMetadata(JSON.stringify(metadata))
  expect(parsed.details).toContainEqual({ key: "indefinite", label: "Süresiz erişim", value: "Evet" })
})

test("ezilen önceki dönem bitişi kayda işlenir", () => {
  const metadata = planActivationAuditMetadata(
    { planTier: "pro", subscriptionStatus: "active", currentPeriodEnd: new Date("2026-01-01T00:00:00Z") },
    "pro",
    "active",
    MONTHLY,
  )
  expect(metadata.previousPeriodEndsAt).toBe("2026-01-01T00:00:00.000Z")
})
