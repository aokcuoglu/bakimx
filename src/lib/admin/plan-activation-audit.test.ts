import { expect, test } from "bun:test"
import { parseAuditMetadata } from "./audit-metadata"
import { planActivationAuditMetadata } from "./plan-activation-audit"

test("elle etkinleştirme kaydı önceki paketi ve durumu taşır (#830)", () => {
  expect(planActivationAuditMetadata({ planTier: "premium", subscriptionStatus: "trialing", liteFreeGrantedAt: null }, "pro", "active")).toEqual({
    tier: "pro",
    status: "active",
    previousTier: "premium",
    previousStatus: "trialing",
  })
})

test("ezilen süresiz Lite hakkı kayda işlenir", () => {
  const metadata = planActivationAuditMetadata({ planTier: "lite", subscriptionStatus: "active", liteFreeGrantedAt: new Date("2026-09-08T00:00:00Z") }, "pro", "active")
  expect(metadata).toEqual({ tier: "pro", status: "active", previousTier: "lite", previousStatus: "active", hadLifetimeLite: true })
  // Damga yalnız paket hâlâ `lite` iken haktır.
  expect(planActivationAuditMetadata({ planTier: "starter", subscriptionStatus: "active", liteFreeGrantedAt: new Date() }, "pro", "active")).not.toHaveProperty("hadLifetimeLite")
})

test("denetim ekranı paket alanlarını okunur adla gösterir", () => {
  const parsed = parseAuditMetadata(JSON.stringify(planActivationAuditMetadata({ planTier: "lite", subscriptionStatus: "active", liteFreeGrantedAt: new Date() }, "pro", "active")))
  expect(parsed.details).toEqual([
    { key: "tier", label: "Paket", value: "Servis Paketi" },
    { key: "status", label: "Durum", value: "Aktif" },
    { key: "previousTier", label: "Önceki paket", value: "Lite (eski)" },
    { key: "previousStatus", label: "Önceki durum", value: "Aktif" },
    { key: "hadLifetimeLite", label: "Süresiz Lite hakkı vardı", value: "Evet" },
  ])
})
