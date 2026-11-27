import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  istanbulDateRange,
  istanbulDayStart,
  istanbulMonthStart,
  istanbulWeekStart,
} from "@/lib/istanbul-time"
import {
  COLLECTION_PERIOD_PRESETS,
  collectionExportParams,
  collectionPeriodFromSearchParams,
  collectionPeriodInput,
  resolveCollectionRange,
} from "./period"

/**
 * #905 — tahsilat dönem filtresi İstanbul gününe göre `[start, end)` kurulur.
 * `now` = 2026-11-30T21:30Z: TR'de 1 Aralık 2026 Salı 00:30, UTC'de hâlâ 30
 * Kasım Pazartesi. Sürecin yerel saatinden kurulan sınırlar (eski kod) UTC
 * sunucuda bu anı Kasım'a ve önceki güne yazardı.
 */
const NOW = new Date("2026-11-30T21:30:00.000Z")
const DAY_MS = 24 * 60 * 60 * 1000

const range = (period: string, extra: { dateFrom?: string; dateTo?: string } = {}) => {
  const { start, end } = resolveCollectionRange({ period, ...extra }, NOW)
  return { start: start?.toISOString(), end: end?.toISOString() }
}

describe("resolveCollectionRange — hazır dönemler", () => {
  test("Bugün: 1 Aralık TR 00:00 → 2 Aralık TR 00:00", () => {
    expect(range("today")).toEqual({
      start: "2026-11-30T21:00:00.000Z",
      end: "2026-12-01T21:00:00.000Z",
    })
  })

  test("Dün: 30 Kasım TR 00:00 → 1 Aralık TR 00:00", () => {
    expect(range("yesterday")).toEqual({
      start: "2026-11-29T21:00:00.000Z",
      end: "2026-11-30T21:00:00.000Z",
    })
  })

  test("Bu Hafta: Pazartesi 30 Kasım → Pazartesi 7 Aralık", () => {
    expect(range("this_week")).toEqual({
      start: "2026-11-29T21:00:00.000Z",
      end: "2026-12-06T21:00:00.000Z",
    })
  })

  test("Geçen Hafta: Pazartesi 23 Kasım → Pazartesi 30 Kasım", () => {
    expect(range("last_week")).toEqual({
      start: "2026-11-22T21:00:00.000Z",
      end: "2026-11-29T21:00:00.000Z",
    })
  })

  test("Bu Ay: 1 Aralık → 1 Ocak", () => {
    expect(range("this_month")).toEqual({
      start: "2026-11-30T21:00:00.000Z",
      end: "2026-12-31T21:00:00.000Z",
    })
  })

  test("Geçen Ay: 1 Kasım → 1 Aralık", () => {
    expect(range("last_month")).toEqual({
      start: "2026-10-31T21:00:00.000Z",
      end: "2026-11-30T21:00:00.000Z",
    })
  })

  test("Son 30 Gün: bugün dahil 30 İstanbul günü", () => {
    const r = range("last_30")
    expect(r).toEqual({
      start: "2026-11-01T21:00:00.000Z",
      end: "2026-12-01T21:00:00.000Z",
    })
    expect(Date.parse(r.end!) - Date.parse(r.start!)).toBe(30 * DAY_MS)
  })

  test("Son 90 Gün: bugün dahil 90 İstanbul günü", () => {
    const r = range("last_90")
    expect(r).toEqual({
      start: "2026-09-02T21:00:00.000Z",
      end: "2026-12-01T21:00:00.000Z",
    })
    expect(Date.parse(r.end!) - Date.parse(r.start!)).toBe(90 * DAY_MS)
  })

  test("Tüm Dönem ve bilinmeyen dönem sınırsızdır", () => {
    expect(resolveCollectionRange({ period: "" }, NOW)).toEqual({})
    expect(resolveCollectionRange({}, NOW)).toEqual({})
    expect(resolveCollectionRange({ period: null }, NOW)).toEqual({})
    expect(resolveCollectionRange({ period: "next_year" }, NOW)).toEqual({})
  })

  test("her hazır dönem seçenekte var ve kapalı bir aralık verir", () => {
    const values = COLLECTION_PERIOD_PRESETS.map((p) => p.value)
    for (const period of values) {
      if (period === "" || period === "custom") continue
      const { start, end } = resolveCollectionRange({ period }, NOW)
      expect(start).toBeInstanceOf(Date)
      expect(end).toBeInstanceOf(Date)
      expect(start!.getTime()).toBeLessThan(end!.getTime())
      // Sınırlar İstanbul gün başlarıdır.
      expect(start).toEqual(istanbulDayStart(start!))
      expect(end).toEqual(istanbulDayStart(end!))
    }
  })
})

describe("resolveCollectionRange — #905 regresyonları", () => {
  test("Dün bugünü içermez", () => {
    const { end } = resolveCollectionRange({ period: "yesterday" }, NOW)
    expect(end).toEqual(istanbulDayStart(NOW))
  })

  test("Geçen Ay bu ayın 1'ini içermez", () => {
    const { end } = resolveCollectionRange({ period: "last_month" }, NOW)
    expect(end).toEqual(istanbulMonthStart(NOW))
  })

  test("Geçen Hafta tam 7 gün ve bu Pazartesi'de biter", () => {
    const { start, end } = resolveCollectionRange({ period: "last_week" }, NOW)
    expect(end).toEqual(istanbulWeekStart(NOW))
    expect(end!.getTime() - start!.getTime()).toBe(7 * DAY_MS)
  })

  test("Bugün / Bu Hafta / Bu Ay bir sonraki dönemin başında biter", () => {
    expect(resolveCollectionRange({ period: "today" }, NOW).end).toEqual(istanbulDayStart(NOW, 1))
    expect(resolveCollectionRange({ period: "this_week" }, NOW).end).toEqual(istanbulWeekStart(NOW, 1))
    expect(resolveCollectionRange({ period: "this_month" }, NOW).end).toEqual(istanbulMonthStart(NOW, 1))
  })
})

describe("resolveCollectionRange — özel aralık (#906)", () => {
  test("custom = istanbulDateRange(dateFrom, dateTo)", () => {
    expect(
      resolveCollectionRange({ period: "custom", dateFrom: "2026-11-20", dateTo: "2026-11-25" }, NOW),
    ).toEqual(istanbulDateRange("2026-11-20", "2026-11-25"))
    expect(range("custom", { dateFrom: "2026-11-20", dateTo: "2026-11-25" })).toEqual({
      start: "2026-11-19T21:00:00.000Z",
      end: "2026-11-25T21:00:00.000Z",
    })
  })

  test("geçersiz özel tarih sınırsız tarafa düşer, 500 vermez", () => {
    expect(resolveCollectionRange({ period: "custom", dateFrom: "2026-02-31", dateTo: "x" }, NOW)).toEqual({
      start: undefined,
      end: undefined,
    })
  })

  test("hazır dönemde dateFrom/dateTo yok sayılır", () => {
    expect(range("today", { dateFrom: "2020-01-01", dateTo: "2020-01-02" })).toEqual(range("today"))
  })
})

/**
 * #906 kabul kriteri: dışa aktarım ile ekran aynı aralığı verir. Sayfa CSV
 * bağlantısına ham filtreleri yazar; rota onları geri okuyup aynı çözümleyiciye
 * verir. Gidiş-dönüş aynı `[start, end)`'i üretmeli.
 */
describe("CSV dışa aktarımı ekranla aynı aralığı kurar", () => {
  type PageParams = { period?: string; dateFrom?: string; dateTo?: string }
  // Sayfanın yaptığı: ham parametre → ortak okuyucu → aralık + CSV bağlantısı.
  const pageSide = (params: PageParams) => {
    const input = collectionPeriodInput(params)
    return { input, range: resolveCollectionRange(input, NOW) }
  }
  // Rotanın yaptığı: bağlantının sorgu dizgisi → ortak okuyucu → aralık.
  const exportSide = (input: ReturnType<typeof collectionPeriodInput>) => {
    const query = collectionExportParams(input).toString()
    return resolveCollectionRange(collectionPeriodFromSearchParams(new URLSearchParams(query)), NOW)
  }

  for (const preset of COLLECTION_PERIOD_PRESETS) {
    test(`dönem: ${preset.label}`, () => {
      const { input, range } = pageSide({ period: preset.value, dateFrom: "2026-11-20", dateTo: "2026-11-25" })
      expect(exportSide(input)).toEqual(range)
    })
  }

  test("period'suz tarih: sayfa da rota da özel aralık sayar", () => {
    const { input, range } = pageSide({ dateFrom: "2026-11-20", dateTo: "2026-11-25" })
    expect(input.period).toBe("custom")
    expect(range).toEqual(istanbulDateRange("2026-11-20", "2026-11-25"))
    expect(exportSide(input)).toEqual(range)
  })

  test("ortak okuyucu: hazır dönem tarihe üstün gelir, boş girdi sınırsız", () => {
    expect(collectionPeriodInput({ period: "today", dateFrom: "2026-11-20" }).period).toBe("today")
    expect(collectionPeriodInput({})).toEqual({ period: "", dateFrom: null, dateTo: null })
    expect(collectionPeriodInput({ period: "", dateFrom: "", dateTo: "" })).toEqual({
      period: "",
      dateFrom: null,
      dateTo: null,
    })
  })

  test("bağlantı ham günü taşır, UTC'ye çevrilmiş günü değil", () => {
    const query = collectionExportParams({ period: "custom", dateFrom: "2026-11-25", dateTo: "2026-11-25" })
    expect(query.get("dateFrom")).toBe("2026-11-25")
    expect(query.get("dateTo")).toBe("2026-11-25")
  })

  test("arama metni ve diğer filtreler bağlantıya taşınır", () => {
    const query = collectionExportParams({ q: "34 ABC", method: "cash", status: "completed", period: "today" })
    expect(query.get("q")).toBe("34 ABC")
    expect(query.get("method")).toBe("cash")
    expect(query.get("status")).toBe("completed")
    expect(query.get("period")).toBe("today")
    expect(query.has("dateFrom")).toBe(false)
    expect(query.has("dateTo")).toBe(false)
  })

  test("period taşımayan eski bağlantı özel aralık sayılır", () => {
    const input = collectionPeriodFromSearchParams(new URLSearchParams("dateFrom=2026-11-20&dateTo=2026-11-25"))
    expect(input.period).toBe("custom")
    expect(resolveCollectionRange(input, NOW)).toEqual(istanbulDateRange("2026-11-20", "2026-11-25"))
  })

  test("filtresiz bağlantı sınırsızdır", () => {
    expect(resolveCollectionRange(collectionPeriodFromSearchParams(new URLSearchParams("type=collections")), NOW))
      .toEqual({})
  })
})

/**
 * Kaynak regresyonu: kullanıcının girdiği gün `new Date("YYYY-MM-DD")` ile
 * (UTC gece yarısı) ayrıştırılmaz, sorgular aralık sonuna gün eklemez — tek
 * sözleşme yarı açık `[start, end)`, "+1 gün" yalnız `istanbulDateRange`'de.
 */
describe("tarih aralığı kaynak regresyonu (#905, #906)", () => {
  const SRC = join(import.meta.dir, "..", "..")
  const read = (rel: string) => readFileSync(join(SRC, rel), "utf8")

  const USER_RANGE_FILES = [
    "app/(app)/cashbox/payments/page.tsx",
    "app/api/cashbox/export/route.ts",
    "app/(app)/reports/orders/page.tsx",
    "app/(app)/reports/customers/page.tsx",
    "app/(app)/reports/collections/page.tsx",
  ]

  for (const rel of USER_RANGE_FILES) {
    test(`${rel} kullanıcı gününü UTC olarak ayrıştırmaz`, () => {
      const source = read(rel)
      expect(source).not.toContain("new Date(params.date")
      expect(source).not.toContain("new Date(searchParams.get(")
      expect(source).not.toContain("toISOString().slice(0, 10)")
    })
  }

  for (const rel of ["lib/reports/queries.ts", "lib/cashbox/queries.ts"]) {
    test(`${rel} aralık sonuna gün eklemez`, () => {
      const source = read(rel)
      expect(source).not.toContain("+ 86400000)")
    })
  }

  test("liste ve CSV aynı okuyucuyu ve çözümleyiciyi kullanır", () => {
    const page = read("app/(app)/cashbox/payments/page.tsx")
    const route = read("app/api/cashbox/export/route.ts")
    expect(page).toContain("collectionPeriodInput(params)")
    expect(page).toContain("resolveCollectionRange(")
    expect(route).toContain("collectionPeriodFromSearchParams(searchParams)")
    expect(route).toContain("resolveCollectionRange(")
  })

  test("kasa KPI'ları (Bugün / Bu Ay) listeyle aynı kapalı aralığı kullanır", () => {
    const source = read("lib/cashbox/queries.ts")
    expect(source).toContain("paymentDate: { gte: today, lt: tomorrow }")
    expect(source).toContain("paymentDate: { gte: monthStartD, lt: nextMonthStartD }")
    expect(source).not.toContain("paymentDate: { gte: today }")
    expect(source).not.toContain("paymentDate: { gte: monthStartD }")
  })
})
