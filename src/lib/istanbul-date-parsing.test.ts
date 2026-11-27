import { describe, expect, test } from "bun:test"
import { parseIstanbulDate } from "@/lib/istanbul-time"
import { trDateToDate } from "@/lib/format"

describe("sunucu tarih ayrıştırma İstanbul gününe bağlı (#933)", () => {
  test("trDateToDate GG.AA.YYYY'yi İstanbul gün başına çevirir (süreç TZ'sinden bağımsız)", () => {
    expect(trDateToDate("26.11.2026")?.toISOString()).toBe("2026-11-25T21:00:00.000Z")
    expect(trDateToDate("01.01.2027")?.toISOString()).toBe("2026-12-31T21:00:00.000Z")
  })

  test("trDateToDate takvimde olmayan ya da boş girdide null döner", () => {
    expect(trDateToDate("31.02.2026")).toBeNull()
    expect(trDateToDate("")).toBeNull()
    expect(trDateToDate(null)).toBeNull()
  })

  test("hatırlatma tarihi (YYYY-MM-DD) İstanbul gece yarısıdır, UTC gece yarısı değil", () => {
    expect(parseIstanbulDate("2026-11-26")?.toISOString()).toBe("2026-11-25T21:00:00.000Z")
  })

  test("indirim kodu bitişi: İstanbul gününün son milisaniyesi", () => {
    const start = parseIstanbulDate("2026-11-26")!
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1)
    expect(end.toISOString()).toBe("2026-11-26T20:59:59.999Z")
  })
})
