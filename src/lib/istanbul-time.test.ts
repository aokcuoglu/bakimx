import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { istanbulDateTimeInputValue, parseIstanbulLocalDateTime } from "./istanbul-time"
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
