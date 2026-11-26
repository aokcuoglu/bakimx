import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { istanbulDateTimeInputValue, parseIstanbulLocalDateTime } from "@/lib/istanbul-time"

const read = (p: string) => readFileSync(p, "utf8")
const FILES = [
  "src/components/cashbox/collection-create-form.tsx",
  "src/components/cashbox/collection-quick-modal.tsx",
  "src/app/(app)/cashbox/actions.ts",
  "src/app/(app)/cashbox/payments/page.tsx",
  "src/app/(app)/cashbox/payments/[id]/page.tsx",
]

describe("tahsilat tarihi İstanbul saati (#931)", () => {
  test("varsayılan değer İstanbul duvar saatidir (UTC+3)", () => {
    expect(istanbulDateTimeInputValue(new Date("2026-11-26T06:00:00Z"))).toBe("2026-11-26T09:00")
  })

  test("sunucu girdiyi İstanbul saati olarak ayrıştırır", () => {
    expect(parseIstanbulLocalDateTime("2026-11-26T09:00")?.toISOString()).toBe("2026-11-26T06:00:00.000Z")
  })

  test("form ve modal tarayıcı saat dilimine bağlı kod kullanmaz; action Istanbul ayrıştırıcıyı kullanır", () => {
    for (const f of FILES.slice(0, 2)) {
      const src = read(f)
      expect(src).not.toContain("getTimezoneOffset")
      expect(src).not.toContain("new Date().toISOString().slice")
      expect(src).not.toContain("new Date(values.paymentDate)")
      expect(src).toContain("istanbulDateTimeInputValue")
    }
    expect(read(FILES[2])).toContain("parseIstanbulLocalDateTime(data.paymentDate)")
  })

  test("eski istemcinin ofsetli ISO değeri reddedilmez, ofsetsiz serbest metin reddedilir", () => {
    const action = read(FILES[2])
    // Deploy anında açık kalan sekme `toISOString()` gönderir; yalnız açık ofsetli değer kabul edilir.
    expect(action).toContain("(?:Z|[+-]\\d{2}:\\d{2})$")
    expect(parseIstanbulLocalDateTime("2026-11-26T06:00:00.000Z")).toBeNull()
  })
})

describe("HTML varlığı JS dizesinde yazılmaz (#959)", () => {
  test("kasa alanında şablon/tırnaklı dizede &bull; yok", () => {
    for (const f of FILES) {
      const offending = read(f)
        .split("\n")
        .filter((l) => /["'`][^"'`]*&(bull|amp|nbsp|middot);[^"'`]*["'`]/.test(l) && /`[^`]*&(bull|amp|nbsp|middot);/.test(l))
      expect(offending).toEqual([])
    }
  })
})
