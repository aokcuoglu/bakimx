import { expect, test } from "bun:test"
import { ADDON_CATALOG } from "@/lib/plans-catalog"
import { DEFAULT_ADDON_ROW_VIEWS, resolveAddonRowViews } from "@/lib/billing/addon-row-state"

function ws(over: Record<string, unknown> = {}) {
  return {
    planTier: "pro" as const,
    subscriptionStatus: "active" as const,
    approvalStatus: "approved" as const,
    trialEndsAt: null,
    currentPeriodEnd: null,
    addons: [] as string[],
    ...over,
  } as Parameters<typeof resolveAddonRowViews>[0]
}

const future = () => new Date(Date.now() + 5 * 86_400_000)
const past = () => new Date(Date.now() - 5 * 86_400_000)
const trial = (over: Record<string, unknown> = {}) =>
  ws({ planTier: "starter", subscriptionStatus: "trialing", trialEndsAt: future(), ...over })

test("pro + ek özellik yok: kapılı satırlar kilitli, AI yakında", () => {
  const v = resolveAddonRowViews(ws())
  for (const item of ADDON_CATALOG) {
    expect(v[item.key].state).toBe(item.shipped ? "locked" : "comingSoon")
  }
})

test("ocrIntake ek özelliği satırı etkin yapar", () => {
  expect(resolveAddonRowViews(ws({ addons: ["ocrIntake"] })).ocrIntake.state).toBe("active")
})

test("şaseden parça: tek anahtar kısmen, iki anahtar etkin", () => {
  const partial = resolveAddonRowViews(ws({ addons: ["vinLookup"] })).vinLookup
  expect(partial.state).toBe("partial")
  expect(partial.openFeatures).toEqual(["vinLookup"])
  const full = resolveAddonRowViews(ws({ addons: ["vinLookup", "partsCatalog"] })).vinLookup
  expect(full.state).toBe("active")
  expect(full.openFeatures).toEqual([])
})

test("aktif deneme: kapılı satırlar denemede açık; satın alınan etkin", () => {
  const v = resolveAddonRowViews(trial())
  expect(v.ocrIntake.state).toBe("trial")
  expect(v.vinLookup.state).toBe("trial")
  const mixed = resolveAddonRowViews(trial({ addons: ["ocrIntake"] }))
  expect(mixed.ocrIntake.state).toBe("active")
  expect(mixed.multiBranch.state).toBe("trial")
})

test("süresi dolmuş deneme kilitli", () => {
  const v = resolveAddonRowViews(trial({ trialEndsAt: past() }))
  expect(v.ocrIntake.state).toBe("locked")
})

test("premium aktif: kapılı satırlar etkin", () => {
  const v = resolveAddonRowViews(ws({ planTier: "premium" }))
  expect(v.ocrIntake.state).toBe("active")
  expect(v.vinLookup.state).toBe("active")
})

test("bilinmeyen dize yok sayılır", () => {
  expect(resolveAddonRowViews(ws({ addons: ["bogus"] })).ocrIntake.state).toBe("locked")
})

test("varsayılan görünümde etkin/deneme/kısmen yok ve anahtarlar katalogla aynı", () => {
  const states = Object.values(DEFAULT_ADDON_ROW_VIEWS).map((v) => v.state)
  expect(states).not.toContain("active")
  expect(states).not.toContain("trial")
  expect(states).not.toContain("partial")
  expect(Object.keys(DEFAULT_ADDON_ROW_VIEWS).sort()).toEqual(ADDON_CATALOG.map((i) => i.key).sort())
  expect(Object.keys(resolveAddonRowViews(ws())).sort()).toEqual(ADDON_CATALOG.map((i) => i.key).sort())
})

test("erişimi olmayan atölyede olumlu rozet yok (past_due, dönem bitti)", () => {
  for (const v of [
    resolveAddonRowViews(ws({ planTier: "premium", subscriptionStatus: "past_due" })),
    resolveAddonRowViews(ws({ planTier: "premium", currentPeriodEnd: past() })),
    resolveAddonRowViews(ws({ addons: ["ocrIntake"], subscriptionStatus: "canceled" })),
  ]) {
    expect(v.ocrIntake.state).toBe("locked")
    expect(v.vinLookup.state).toBe("locked")
  }
})

test("premium satırda süresi dolmuş deneme kilitli", () => {
  const v = resolveAddonRowViews(
    ws({ planTier: "premium", subscriptionStatus: "trialing", trialEndsAt: past() }),
  )
  expect(v.ocrIntake.state).toBe("locked")
})

test("eski lite ve starter + ek özellik: yalnız satın alınan etkin", () => {
  for (const planTier of ["lite", "starter"] as const) {
    const v = resolveAddonRowViews(ws({ planTier, addons: ["ocrIntake"] }))
    expect(v.ocrIntake.state).toBe("active")
    expect(v.multiBranch.state).toBe("locked")
  }
})

test("lifetime Lite: ek özellik yoksa kilitli, varsa etkin", () => {
  const base = { planTier: "lite" as const, subscriptionStatus: "canceled" as const, liteFreeGrantedAt: new Date() }
  expect(resolveAddonRowViews(ws(base)).ocrIntake.state).toBe("locked")
  expect(resolveAddonRowViews(ws({ ...base, addons: ["ocrIntake"] })).ocrIntake.state).toBe("active")
})

test("deneme + yalnız vinLookup: satır denemede açık", () => {
  const v = resolveAddonRowViews(trial({ addons: ["vinLookup"] }))
  expect(v.vinLookup.state).toBe("trial")
})

test("yayımlanmamış ek özellik her durumda yakında", () => {
  for (const w of [
    ws(),
    ws({ planTier: "premium" }),
    ws({ addons: ["eInvoice"] }),
    trial(),
    trial({ trialEndsAt: past() }),
  ]) {
    const v = resolveAddonRowViews(w)
    expect(v.eInvoice.state).toBe("comingSoon")
    expect(v.aiAssistant.state).toBe("comingSoon")
  }
})
