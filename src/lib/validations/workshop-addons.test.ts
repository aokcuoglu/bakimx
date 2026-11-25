import { expect, test } from "bun:test"
import {
  addonsFromToggles,
  diffAddons,
  extraVinQuotaSchema,
  togglesFromAddons,
  workshopAddonsSchema,
} from "@/lib/validations/workshop-addons"

test("workshopAddonsSchema yalnız bilinen ek özellik anahtarlarını kabul eder", () => {
  expect(workshopAddonsSchema.safeParse(["vinLookup", "eInvoice"]).success).toBe(true)
  expect(workshopAddonsSchema.safeParse([]).success).toBe(true)
  expect(workshopAddonsSchema.safeParse(["appointments"]).success).toBe(false)
  expect(workshopAddonsSchema.safeParse(["uydurma"]).success).toBe(false)
  expect(workshopAddonsSchema.safeParse("vinLookup").success).toBe(false)
})

test("extraVinQuotaSchema tam sayı, 0..100.000 aralığı ve sayı dizgesini kabul eder", () => {
  expect(extraVinQuotaSchema.parse("2500")).toBe(2500)
  expect(extraVinQuotaSchema.parse(0)).toBe(0)
  expect(extraVinQuotaSchema.safeParse(-1).success).toBe(false)
  expect(extraVinQuotaSchema.safeParse(1.5).success).toBe(false)
  expect(extraVinQuotaSchema.safeParse(100_001).success).toBe(false)
  expect(extraVinQuotaSchema.safeParse("abc").success).toBe(false)
  // boş girdi sessizce 0'a çevrilmez
  for (const empty of [null, undefined, "", "  ", []]) {
    expect(extraVinQuotaSchema.safeParse(empty).success).toBe(false)
  }
  const blank = extraVinQuotaSchema.safeParse("")
  expect(blank.success ? "" : blank.error.issues[0]?.message).toBe("Ek kota boş bırakılamaz.")
})

test("diffAddons önce/sonra, eklenen ve kaldırılanı normalize ederek verir", () => {
  expect(diffAddons(["vinLookup", "eski-deger"], ["multiBranch", "vinLookup", "vinLookup"])).toEqual({
    before: ["vinLookup"],
    after: ["vinLookup", "multiBranch"],
    added: ["multiBranch"],
    removed: [],
  })
  const none = diffAddons(["ocrIntake"], ["ocrIntake"])
  expect(none.added).toEqual([])
  expect(none.removed).toEqual([])
})

test("form anahtar haritası ile liste birbirine döner", () => {
  const toggles = togglesFromAddons(["ocrIntake", "bilinmeyen"])
  expect(toggles.ocrIntake).toBe(true)
  expect(toggles.vinLookup).toBe(false)
  expect(addonsFromToggles(toggles)).toEqual(["ocrIntake"])
})
