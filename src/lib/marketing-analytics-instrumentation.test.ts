import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dir, "..")
const source = (path: string) => readFileSync(join(root, path), "utf8")

describe("marketing conversion instrumentation", () => {
  test("success events stay behind their API success boundaries", () => {
    for (const [file, success, event] of [
      ["components/auth/register-form.tsx", "if (!data.ok)", "register_submitted"],
      ["components/auth/register-form.tsx", "if (res.ok)", "demo_submitted"],
      ["components/sections/HeroLeadForm.tsx", "if (!response.ok)", "demo_submitted"],
      ["components/site-assistant/views/demo-form-view.tsx", "if (res.ok)", "demo_submitted"],
      ["components/marketing/landing/callback-dialog.tsx", "if (!response.ok)", "demo_submitted"],
      ["components/billing/purchase-wizard.tsx", "if (data.success)", "purchase_submitted"],
    ] as const) {
      const text = source(file)
      expect(text.indexOf(success)).toBeGreaterThan(-1)
      expect(text.indexOf(event)).toBeGreaterThan(text.indexOf(success))
    }
  })

  test("all conversion forms use a synchronous submit lock", () => {
    for (const file of [
      "components/auth/register-form.tsx", "components/sections/HeroLeadForm.tsx",
      "components/site-assistant/views/demo-form-view.tsx",
      "components/billing/purchase-wizard.tsx",
      "components/marketing/landing/callback-dialog.tsx",
    ]) {
      const text = source(file)
      expect(text).toContain("if (submitRef.current) return")
      expect(text).toContain("submitRef.current = true")
    }
  })

  // #781: ana sayfanın talep yolu artık "Sizi arayalım" penceresi. /demo formu gibi
  // reklam ilişkilendirmesini (onaya bağlı) gönderip başarılı kayıtta dönüşümü işlemeli.
  test("demo talebi formları reklam ilişkilendirmesini ve dönüşümü taşır", () => {
    for (const file of ["components/sections/HeroLeadForm.tsx", "components/marketing/landing/callback-dialog.tsx"]) {
      const text = source(file)
      expect(text).toContain("captureDemoAttribution()")
      expect(text).toContain("attribution: getDemoAttribution()")
      expect(text).toContain("targetingConsent: hasDemoAdvertisingConsent()")
      expect(text).toContain("trackDemoAdvertisingConversion(result.eventId)")
    }
  })
})
