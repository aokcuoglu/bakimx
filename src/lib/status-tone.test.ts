import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import * as constants from "@/lib/constants"
import { COLLECTION_STATUS_TONES, EXTENDED_PAYMENT_STATUS, PAYMENT_METHOD_TONES } from "@/lib/cashbox/status"
import { STOCK_STATUS } from "@/lib/parts/status"
import { statusToneBadgeVariant, type StatusTone } from "@/lib/status-tone"

const TONES: StatusTone[] = ["success", "warning", "destructive", "primary", "neutral"]

describe("statusToneBadgeVariant (#1021)", () => {
  test("her ton bir Badge tint varyantına, nötr secondary'ye gider", () => {
    expect(statusToneBadgeVariant("success")).toBe("success-tint")
    expect(statusToneBadgeVariant("warning")).toBe("warning-tint")
    expect(statusToneBadgeVariant("destructive")).toBe("destructive-tint")
    expect(statusToneBadgeVariant("primary")).toBe("primary-tint")
    expect(statusToneBadgeVariant("neutral")).toBe("secondary")
  })

  test("tanımsız ve prototip anahtarları nötre düşer", () => {
    expect(statusToneBadgeVariant(undefined)).toBe("secondary")
    expect(statusToneBadgeVariant(null)).toBe("secondary")
    expect(statusToneBadgeVariant("constructor" as StatusTone)).toBe("secondary")
  })
})

describe("durum tabloları ton adı tutar, sınıf dizisi değil (#1021)", () => {
  test("constants.ts / cashbox / parts tablolarındaki her ton geçerli", () => {
    const tables = Object.values(constants).filter(
      (v): v is Record<string, { tone?: StatusTone }> => typeof v === "object" && v !== null && !Array.isArray(v)
    )
    let seen = 0
    for (const table of tables) {
      for (const entry of Object.values(table)) {
        if (typeof entry === "object" && entry !== null && "tone" in entry) {
          seen++
          expect(TONES).toContain(entry.tone as StatusTone)
        }
      }
    }
    for (const tone of [...Object.values(PAYMENT_METHOD_TONES), ...Object.values(COLLECTION_STATUS_TONES)]) {
      seen++
      expect(TONES).toContain(tone)
    }
    for (const entry of [...Object.values(EXTENDED_PAYMENT_STATUS), ...Object.values(STOCK_STATUS)]) {
      seen++
      expect(TONES).toContain(entry.tone)
    }
    expect(seen).toBeGreaterThan(60)
  })

  test("tablo dosyalarında bg-/border- sınıf dizisi kalmadı", () => {
    for (const file of ["lib/constants.ts", "lib/cashbox/status.ts", "lib/parts/status.ts"]) {
      const source = readFileSync(join(import.meta.dir, "..", file), "utf8")
      expect(source.match(/"[^"\n]*\b(?:bg|border)-[a-z-]+[^"\n]*"/g) ?? []).toEqual([])
    }
  })

  test("ton eşlemesi mevcut tonları korur (örnekler)", () => {
    expect(constants.ORDER_STATUS.cancelled.tone).toBe("destructive")
    expect(constants.ORDER_STATUS.waiting_parts.tone).toBe("warning")
    expect(constants.ORDER_STATUS.draft.tone).toBe("neutral")
    expect(constants.PAYMENT_STATUS.overpaid.tone).toBe("primary")
    expect(constants.CUSTOMER_TYPES.corporate.tone).toBe("neutral")
  })
})
