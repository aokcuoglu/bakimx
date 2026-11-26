import { test, expect, describe } from "bun:test"
import { parsePaidPeriodFlags, parseSetAddonsArgs, planAddonsChange, resolvePaidPeriod } from "./workshop-admin"

/**
 * `set-plan` ücretli dönem yazabildiğinden beri bu script erişim kapısını
 * (`getPlanState` → `subscription_expired`) doğrudan etkiliyor. Saf ayrıştırma
 * ve dönem hesabı burada kilitleniyor; DB'ye dokunan kısım testin dışında.
 */

const NOW = new Date("2026-08-09T12:00:00.000Z")

describe("parsePaidPeriodFlags", () => {
  test("bayrak yoksa boş seçenek döner", () => {
    expect(parsePaidPeriodFlags([])).toEqual({ options: {}, error: null })
  })

  test("--cycle ve --ends-in birlikte okunur", () => {
    expect(parsePaidPeriodFlags(["--cycle", "yearly", "--ends-in", "3"])).toEqual({
      options: { cycle: "yearly", endsInDays: 3 },
      error: null,
    })
  })

  test("negatif gün kabul edilir (süresi dolmuş aboneliği simüle etmek için)", () => {
    expect(parsePaidPeriodFlags(["--ends-in", "-5"]).options).toEqual({ endsInDays: -5 })
  })

  test("geçersiz cycle reddedilir", () => {
    const r = parsePaidPeriodFlags(["--cycle", "haftalik"])
    expect(r.options).toBeNull()
    expect(r.error).toContain("--cycle")
  })

  test("eksik cycle değeri reddedilir", () => {
    expect(parsePaidPeriodFlags(["--cycle"]).options).toBeNull()
  })

  test("tam sayı olmayan gün reddedilir", () => {
    expect(parsePaidPeriodFlags(["--ends-in", "1.5"]).options).toBeNull()
    expect(parsePaidPeriodFlags(["--ends-in", "yarin"]).options).toBeNull()
  })

  test("bilinmeyen bayrak sessizce yutulmaz", () => {
    const r = parsePaidPeriodFlags(["--period", "1y"])
    expect(r.options).toBeNull()
    expect(r.error).toContain("--period")
  })
})

describe("resolvePaidPeriod", () => {
  test("bayrak yoksa null — dönem alanlarına dokunulmaz", () => {
    expect(resolvePaidPeriod(NOW, {})).toBeNull()
  })

  test("--cycle yearly bir yıl sonrasını yazar", () => {
    const r = resolvePaidPeriod(NOW, { cycle: "yearly" })
    expect(r?.billingCycle).toBe("yearly")
    expect(r?.currentPeriodEnd.toISOString()).toBe("2027-08-09T12:00:00.000Z")
  })

  test("--cycle monthly bir ay sonrasını yazar", () => {
    const r = resolvePaidPeriod(NOW, { cycle: "monthly" })
    expect(r?.currentPeriodEnd.toISOString()).toBe("2026-09-09T12:00:00.000Z")
  })

  test("--ends-in cycle'ın hesabını ezer, cycle etiketi korunur", () => {
    const r = resolvePaidPeriod(NOW, { cycle: "yearly", endsInDays: 3 })
    expect(r?.billingCycle).toBe("yearly")
    expect(r?.currentPeriodEnd.toISOString()).toBe("2026-08-12T12:00:00.000Z")
  })

  test("yalnız --ends-in verilirse cycle monthly'ye düşer", () => {
    const r = resolvePaidPeriod(NOW, { endsInDays: 10 })
    expect(r?.billingCycle).toBe("monthly")
    expect(r?.currentPeriodEnd.toISOString()).toBe("2026-08-19T12:00:00.000Z")
  })

  test("negatif gün geçmişte bir dönem sonu üretir (kilit testi)", () => {
    const r = resolvePaidPeriod(NOW, { endsInDays: -1 })
    expect(r!.currentPeriodEnd.getTime()).toBeLessThan(NOW.getTime())
  })
})

describe("parseSetAddonsArgs", () => {
  test("--apply yoksa kuru çalıştırma (apply=false)", () => {
    expect(parseSetAddonsArgs("vinLookup", []).args).toEqual({ addons: ["vinLookup"], apply: false })
  })

  test("--apply yazımı açar; liste tekilleştirilir ve katalog sırasına girer", () => {
    const r = parseSetAddonsArgs("eInvoice,vinLookup,eInvoice", ["--apply"])
    expect(r.args).toEqual({ addons: ["vinLookup", "eInvoice"], apply: true })
  })

  test("none tüm ek özellikleri kapatır", () => {
    expect(parseSetAddonsArgs("none", ["--apply"]).args).toEqual({ addons: [], apply: true })
  })

  test("bilinmeyen özellik, bilinmeyen bayrak ve eksik liste reddedilir", () => {
    expect(parseSetAddonsArgs("foo", []).args).toBeNull()
    expect(parseSetAddonsArgs("vinLookup", ["--yes"]).error).toContain("--yes")
    expect(parseSetAddonsArgs(undefined, []).args).toBeNull()
  })
})

describe("planAddonsChange", () => {
  test("eklenen ve kaldırılanı ayırır", () => {
    const p = planAddonsChange(["vinLookup", "ocrIntake"], ["ocrIntake", "eInvoice"])
    expect(p.added).toEqual(["eInvoice"])
    expect(p.removed).toEqual(["vinLookup"])
    expect(p.noop).toBe(false)
  })

  test("aynı küme (sıra/bilinmeyen değer fark etmez) = noop", () => {
    expect(planAddonsChange(["eInvoice", "vinLookup", "legacy"], ["vinLookup", "eInvoice"]).noop).toBe(true)
  })
})
