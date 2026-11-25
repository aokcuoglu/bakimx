import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { trDayKey } from "./format-date"
import {
  istanbulDateTimeInputValue,
  istanbulDayBounds,
  istanbulDayKey,
  istanbulDayStart,
  istanbulMonthBounds,
  istanbulMonthStart,
  istanbulRecentDays,
  istanbulRecentMonths,
  parseIstanbulLocalDateTime,
} from "./istanbul-time"
import * as salesTime from "./sales/time"

/**
 * #861 — kullanıcının girdiği saat Türkiye duvar saatidir. Saklanan değer, TR
 * saatli bir sunucudaki eski `new Date("…T09:00")` davranışıyla birebir aynı
 * kalmalı (09:00 → 06:00Z), ama artık sürecin `TZ`'sinden bağımsız. Bu dosya
 * bilinçli olarak farklı `TZ` değerleriyle de koşulur:
 *   TZ=UTC bun test src/lib/istanbul-time.test.ts
 *   TZ=America/New_York bun test src/lib/istanbul-time.test.ts
 */

describe("parseIstanbulLocalDateTime", () => {
  test("randevu: 2026-11-25 + 09:00 her TZ'de 06:00Z olarak saklanır", () => {
    const appointmentAt = "2026-11-25"
    const appointmentTime = "09:00"
    expect(parseIstanbulLocalDateTime(`${appointmentAt}T${appointmentTime}`)?.toISOString()).toBe(
      "2026-11-25T06:00:00.000Z",
    )
  })

  test("tahmini teslim: datetime-local değeri İstanbul saatidir", () => {
    expect(parseIstanbulLocalDateTime("2026-11-25T09:00")?.toISOString()).toBe("2026-11-25T06:00:00.000Z")
    expect(parseIstanbulLocalDateTime("2026-11-25T01:30")?.toISOString()).toBe("2026-11-24T22:30:00.000Z")
  })

  test("saniyeli `time` girdisini de kabul eder", () => {
    expect(parseIstanbulLocalDateTime("2026-11-25T09:00:30")?.toISOString()).toBe("2026-11-25T06:00:30.000Z")
  })

  test("geçersiz ya da takvim dışı değerde null döner", () => {
    for (const value of ["", "geçersiz", "2026-11-25", "2026-11-25T9:00", "2026-02-31T09:00", "2026-11-25T24:00"]) {
      expect(parseIstanbulLocalDateTime(value)).toBeNull()
    }
  })
})

describe("istanbulDateTimeInputValue", () => {
  test("06:00Z giriş kutusunda 09:00 görünür", () => {
    expect(istanbulDateTimeInputValue(new Date("2026-11-25T06:00:00.000Z"))).toBe("2026-11-25T09:00")
  })

  test("UTC 22:30 giriş kutusunda Türkiye'nin ertesi günüdür", () => {
    expect(istanbulDateTimeInputValue(new Date("2026-11-24T22:30:00.000Z"))).toBe("2026-11-25T01:30")
  })

  test("düzenlemeden kaydetmek saati kaydırmaz (taslak → ayrıştırma gidiş-dönüşü)", () => {
    const stored = new Date("2026-11-25T06:00:00.000Z")
    expect(parseIstanbulLocalDateTime(istanbulDateTimeInputValue(stored))).toEqual(stored)
  })
})

test("sales/time eski ihracı aynı fonksiyonları verir", () => {
  expect(salesTime.parseIstanbulLocalDateTime).toBe(parseIstanbulLocalDateTime)
  expect(salesTime.istanbulDateTimeInputValue).toBe(istanbulDateTimeInputValue)
  expect(salesTime.istanbulDayBounds).toBe(istanbulDayBounds)
  expect(salesTime.istanbulMonthBounds).toBe(istanbulMonthBounds)
})

/**
 * #874 — "bugün", "bu ay" ve günlük grafik kovaları Türkiye takvimine göre.
 * Eski kod `setHours(0, 0, 0, 0)` / `new Date(y, m, d)` ile SÜRECİN gece
 * yarısını kuruyordu: UTC'de koşan sunucuda TR 00:00–03:00 arası kayıtlar
 * önceki güne düşüyordu. Beklentiler yalnız sabit UTC anlarıyla yazılır.
 */
describe("gün sınırları (#874)", () => {
  // TR 26.11.2026 00:30 — UTC'de hâlâ 25.11.
  const NOW = new Date("2026-11-25T21:30:00.000Z")

  test("kabul: TR 00:30'da bugün TR 00:00'da başlar ve o anki kayıt bugündür", () => {
    const { start, end } = istanbulDayBounds(NOW)
    expect(start.toISOString()).toBe("2026-11-25T21:00:00.000Z")
    expect(end.toISOString()).toBe("2026-11-26T21:00:00.000Z")

    const record = new Date("2026-11-25T21:30:00.000Z")
    expect(record >= start && record < end).toBe(true)
  })

  test("istanbulDayStart bugünün başını verir, günün her anında aynı", () => {
    for (const at of ["2026-11-25T21:00:00.000Z", "2026-11-25T21:30:00.000Z", "2026-11-26T20:59:59.999Z"]) {
      expect(istanbulDayStart(new Date(at)).toISOString()).toBe("2026-11-25T21:00:00.000Z")
    }
    expect(istanbulDayStart(NOW)).toEqual(istanbulDayBounds(NOW).start)
  })

  test("istanbulDayStart kaydırması ay ve yıl sonunu aşar", () => {
    expect(istanbulDayStart(NOW, 1).toISOString()).toBe("2026-11-26T21:00:00.000Z")
    expect(istanbulDayStart(NOW, 7).toISOString()).toBe("2026-12-02T21:00:00.000Z")
    expect(istanbulDayStart(NOW, -90).toISOString()).toBe("2026-08-27T21:00:00.000Z")

    // TR 31.12.2026 23:30 → yarın 01.01.2027
    expect(istanbulDayStart(new Date("2026-12-31T20:30:00.000Z"), 1).toISOString()).toBe(
      "2026-12-31T21:00:00.000Z",
    )
    // TR 01.01.2027 00:30 → bugün 01.01.2027, dün 31.12.2026
    const newYear = new Date("2026-12-31T21:30:00.000Z")
    expect(istanbulDayStart(newYear).toISOString()).toBe("2026-12-31T21:00:00.000Z")
    expect(istanbulDayStart(newYear, -1).toISOString()).toBe("2026-12-30T21:00:00.000Z")
  })
})

describe("ay sınırları (#874)", () => {
  test("istanbulMonthStart: TR 01.09 01:30 eylülün başındadır", () => {
    expect(istanbulMonthStart(new Date("2026-08-31T22:30:00.000Z")).toISOString()).toBe(
      "2026-08-31T21:00:00.000Z",
    )
    // TR 31.08 23:30 hâlâ ağustostur.
    expect(istanbulMonthStart(new Date("2026-08-31T20:30:00.000Z")).toISOString()).toBe(
      "2026-07-31T21:00:00.000Z",
    )
  })

  test("istanbulMonthStart kaydırması ocaktan geriye yılı aşar", () => {
    // TR 01.01.2027 00:30
    const newYear = new Date("2026-12-31T21:30:00.000Z")
    expect(istanbulMonthStart(newYear).toISOString()).toBe("2026-12-31T21:00:00.000Z")
    expect(istanbulMonthStart(newYear, -1).toISOString()).toBe("2026-11-30T21:00:00.000Z")
    expect(istanbulMonthStart(new Date("2027-01-15T10:00:00.000Z"), -1).toISOString()).toBe(
      "2026-11-30T21:00:00.000Z",
    )
    expect(istanbulMonthStart(newYear, 1).toISOString()).toBe("2027-01-31T21:00:00.000Z")
  })

  test("istanbulMonthStart, istanbulMonthBounds ile aynı başlangıcı verir", () => {
    const now = new Date("2026-08-31T22:30:00.000Z")
    expect(istanbulMonthStart(now)).toEqual(istanbulMonthBounds(undefined, now).start)
  })
})

describe("günlük kova anahtarı (#874)", () => {
  test("istanbulDayKey UTC değil Türkiye gününü verir", () => {
    expect(istanbulDayKey(new Date("2026-11-24T22:30:00.000Z"))).toBe("2026-11-25")
    expect(istanbulDayKey(new Date("2026-11-24T20:59:59.999Z"))).toBe("2026-11-24")
  })

  test("istanbulDayKey biçimleme kaynağı trDayKey ile aynı", () => {
    for (const at of [
      "2026-11-24T22:30:00.000Z",
      "2026-11-24T21:00:00.000Z",
      "2026-11-24T20:59:59.999Z",
      "2026-12-31T21:00:00.000Z",
      "2026-02-28T22:00:00.000Z",
      "2026-06-15T12:00:00.000Z",
    ]) {
      expect(istanbulDayKey(new Date(at))).toBe(trDayKey(new Date(at)))
    }
  })
})

describe("istanbulRecentDays (#874)", () => {
  // TR 26.11.2026 00:30 (Perşembe)
  const NOW = new Date("2026-11-25T21:30:00.000Z")

  test("eskiden yeniye 30 gün, son öğe bugün", () => {
    const days = istanbulRecentDays(30, NOW)
    expect(days).toHaveLength(30)
    expect(days[29]).toEqual({
      key: "2026-11-26",
      start: new Date("2026-11-25T21:00:00.000Z"),
      weekday: 4,
    })
    expect(days[0]).toEqual({
      key: "2026-10-28",
      start: new Date("2026-10-27T21:00:00.000Z"),
      weekday: 3,
    })
  })

  test("kovalar ardışık Türkiye günleridir", () => {
    const days = istanbulRecentDays(30, NOW)
    for (let i = 1; i < days.length; i++) {
      expect(days[i].start.getTime() - days[i - 1].start.getTime()).toBe(24 * 60 * 60 * 1000)
      expect(days[i].weekday).toBe((days[i - 1].weekday + 1) % 7)
    }
    for (const day of days) {
      expect(day.key).toBe(trDayKey(day.start))
    }
  })

  test("regresyon: TR 01:30 kaydı UTC gününe değil bugünün kovasına düşer", () => {
    const days = istanbulRecentDays(14, NOW)
    const record = new Date("2026-11-25T22:30:00.000Z")
    expect(istanbulDayKey(record)).toBe(days[days.length - 1].key)
  })

  test("sıfır gün boş liste döner", () => {
    expect(istanbulRecentDays(0, NOW)).toEqual([])
  })
})

describe("istanbulRecentMonths (#874)", () => {
  // TR 26.11.2026 00:30
  const NOW = new Date("2026-11-25T21:30:00.000Z")

  test("eskiden yeniye 12 ay, son öğe bu ay, yıl dönümünü aşar", () => {
    const months = istanbulRecentMonths(12, NOW)
    expect(months.map((m) => m.key)).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
    ])
    expect(months[0]).toEqual({
      key: "2025-12",
      start: new Date("2025-11-30T21:00:00.000Z"),
      end: new Date("2025-12-31T21:00:00.000Z"),
      year: 2025,
      month: 11,
    })
    expect(months[1]).toMatchObject({ year: 2026, month: 0, start: new Date("2025-12-31T21:00:00.000Z") })
    expect(months[11]).toEqual({
      key: "2026-11",
      start: new Date("2026-10-31T21:00:00.000Z"),
      end: new Date("2026-11-30T21:00:00.000Z"),
      year: 2026,
      month: 10,
    })
  })

  test("her ayın sonu bir sonrakinin başıdır", () => {
    const months = istanbulRecentMonths(12, NOW)
    for (let i = 1; i < months.length; i++) {
      expect(months[i].start).toEqual(months[i - 1].end)
    }
  })

  test("ayın ilk TR saatlerinde yeni ay sayılır", () => {
    // TR 01.09.2026 01:30 — UTC'de hâlâ 31.08.
    const months = istanbulRecentMonths(6, new Date("2026-08-31T22:30:00.000Z"))
    expect(months.map((m) => m.key)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"])
  })
})

/**
 * #874 regresyonu: sunucu tarafı gün/ay sınırları sürecin saat diliminden
 * kurulmaz. Taşınan dosyalara eski kalıplar geri girmesin.
 */
describe("gün/ay sınırları İstanbul yardımcılarından gelir", () => {
  const SRC = join(import.meta.dir, "..")
  const MIGRATED = [
    "lib/dashboard/queries.ts",
    "lib/orders/delivery-filter.ts",
    "app/(app)/appointments/actions.ts",
    "app/(app)/appointments/page.tsx",
    "lib/reports/queries.ts",
    "lib/analytics/queries.ts",
    "lib/cashbox/queries.ts",
  ]

  for (const rel of MIGRATED) {
    test(rel, () => {
      const source = readFileSync(join(SRC, rel), "utf8")
      expect(source).not.toContain("setHours(0, 0, 0, 0)")
      expect(source).not.toContain(".getFullYear(), now.getMonth()")
      expect(source).not.toContain("toISOString().slice(0, 10)")
    })
  }
})

/**
 * Regresyon: randevu ve tahmini teslim saati eskiden sunucu yerel saatinde
 * ayrıştırılıyor, iş emri taslağı UTC duvar saatinden doluyordu — TR saatli
 * sunucuda her kayıt tahmini teslimi 3 saat geri kaydırıyordu.
 */
describe("yazma tarafı İstanbul yardımcılarını kullanır", () => {
  const SRC = join(import.meta.dir, "..")
  const read = (rel: string) => readFileSync(join(SRC, rel), "utf8")

  test("randevu oluşturma", () => {
    const source = read("app/(app)/appointments/actions.ts")
    expect(source).toContain("parseIstanbulLocalDateTime(`${appointmentAt}T${appointmentTime}`)")
    expect(source).not.toMatch(/new Date\(`\$\{appointmentAt\}T/)
  })

  test("tahmini teslim kaydı", () => {
    const source = read("app/(app)/orders/actions.ts")
    expect(source).toContain("parseIstanbulLocalDateTime(parsed.data.estimatedDeliveryAt)")
    expect(source).not.toContain("new Date(parsed.data.estimatedDeliveryAt)")
  })

  test("iş emri taslağı UTC duvar saatinden dolmaz", () => {
    const source = read("components/orders/work-order-detail.tsx")
    expect(source).not.toMatch(/estimatedDeliveryAt\)\.toISOString\(\)\.slice\(0, 16\)/)
  })
})
