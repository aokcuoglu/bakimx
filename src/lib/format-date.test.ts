import { describe, expect, test } from "bun:test"

import {
  formatTodayTr,
  formatTrDate,
  formatTrDateTime,
  formatTrLongDate,
  formatTrMediumDate,
  formatTrShortDate,
  formatTrTime,
  trDayKey,
} from "./format-date"
import { formatDate, formatDateTime } from "./utils-client"

/**
 * #861 — çıktı sürecin saat diliminden bağımsız olmalı. Bu dosya bilinçli olarak
 * farklı `TZ` değerleriyle de koşulur:
 *   TZ=UTC bun test src/lib/format-date.test.ts
 *   TZ=America/New_York bun test src/lib/format-date.test.ts
 */

const MORNING = "2026-11-25T06:00:00Z" // TR 09:00
const LATE_NIGHT = "2026-11-24T22:30:00Z" // TR 25.11.2026 01:30

describe("Europe/Istanbul biçimleyicileri", () => {
  test("UTC 06:00 Türkiye'de 09:00'dur", () => {
    expect(formatTrTime(MORNING)).toBe("09:00")
  })

  test("UTC 22:30 Türkiye'de ertesi gündür", () => {
    expect(formatTrDate(LATE_NIGHT)).toBe("25.11.2026")
    expect(formatTrDateTime(LATE_NIGHT)).toBe("25.11.2026 01:30")
    expect(formatTrTime(LATE_NIGHT)).toBe("01:30")
    expect(trDayKey(LATE_NIGHT)).toBe("2026-11-25")
    expect(formatTrShortDate(LATE_NIGHT)).toBe("25 Kas")
    expect(formatTrMediumDate(LATE_NIGHT)).toBe("25 Kas 2026")
    expect(formatTrLongDate(LATE_NIGHT)).toBe("25 Kasım 2026")
  })

  test("string ve Date girdisi aynı çıktıyı verir", () => {
    const formatters = [
      formatTrDate,
      formatTrTime,
      formatTrDateTime,
      formatTrShortDate,
      formatTrMediumDate,
      formatTrLongDate,
      formatTodayTr,
      trDayKey,
    ]
    for (const fn of formatters) {
      expect(fn(new Date(LATE_NIGHT))).toBe(fn(LATE_NIGHT))
    }
  })

  test("geçersiz tarih RangeError atmaz, boş değer döner", () => {
    expect(formatTrDate("geçersiz")).toBe("—")
    expect(formatTrTime(new Date(Number.NaN))).toBe("—")
    expect(formatTrDateTime("")).toBe("—")
    expect(trDayKey("geçersiz")).toBe("—")
  })
})

// #857'den taşındı (eski `src/lib/format-today.test.ts`).
describe("formatTodayTr", () => {
  test("UTC gece yarısı öncesi Türkiye'de ertesi gündür", () => {
    const out = formatTodayTr(new Date("2026-11-24T22:30:00Z"))
    expect(out).toContain("25")
    expect(out).toContain("Çarşamba")
  })

  test("Türkiye gün içinde aynı gün", () => {
    const out = formatTodayTr(new Date("2026-11-25T09:00:00Z"))
    expect(out).toContain("25")
  })

  test("tam biçim: gün, ay, haftanın günü", () => {
    expect(formatTodayTr(LATE_NIGHT)).toBe("25 Kasım Çarşamba")
  })
})

describe("utils-client yeniden ihracı", () => {
  test("aynı fonksiyon referansı", () => {
    expect(formatDate).toBe(formatTrDate)
    expect(formatDateTime).toBe(formatTrDateTime)
  })
})
