/**
 * Ürünün kırmızı çizgisi: **hiçbir servis diğerinin fiyatını göremez** (BAK-77).
 *
 * Bu kapı iki yönlü tarar:
 *
 * 1. **Üretilen nesne** — `buildCrossWorkshopHistory` çıktısında para çağrıştıran
 *    bir anahtar var mı? Yani biri tipe alan ekleyip doldurursa burada düşer.
 * 2. **Veri erişimi kaynağı** — `queries.ts` içinde para kolonu seçiliyor mu?
 *    `select` yerine `include` yazan biri modele sonradan eklenen bir tutarı
 *    farkında olmadan dışarı akıtabilirdi; bu tarama onu da yakalar.
 *
 * Not: taramayı gevşetmek yerine, gerçekten gerekiyorsa MONEY_KEYS listesini
 * gerekçesiyle daralt (bkz. docs/agent-workflows/repo-guardrails.md §5).
 */

import { test, expect } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { buildCrossWorkshopHistory, type ForeignVehicleRow } from "./build"

/** Para/ödeme çağrıştıran anahtar parçaları (küçük harfe indirilerek aranır). */
const MONEY_KEYS = [
  "price",
  "total",
  "amount",
  "kurus",
  "kuruş",
  "fiyat",
  "tutar",
  "discount",
  "indirim",
  "tax",
  "vat",
  "kdv",
  "paid",
  "payment",
  "odeme",
  "ödeme",
  "cost",
  "maliyet",
  "invoice",
  "fatura",
  "currency",
  "try",
]

function collectKeys(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const v of value) collectKeys(v, out)
    return out
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      out.push(k)
      collectKeys(v, out)
    }
  }
  return out
}

const FULL_ROW: ForeignVehicleRow = {
  workshopId: "ws-other",
  workshopName: "Yılmaz Oto Servis",
  workshopCity: "İstanbul",
  updatedAt: new Date("2026-03-01T10:00:00Z"),
  brand: "CITROEN",
  model: "C5 AIRCROSS",
  vehicleType: "otomobil",
  modelYear: 2021,
  color: "Beyaz",
  fuelType: "diesel",
  transmission: "automatic",
  vin: "VF7ABCDE123456789",
  engineNo: "MOTOR9988",
  mileage: 84000,
  customer: {
    type: "individual",
    firstName: "Okan",
    lastName: "Türkyılmaz",
    fullName: null,
    companyName: null,
    phone: "05321112245",
    email: "okan@ornek.com",
    city: "İstanbul",
  },
  intakes: [
    {
      createdAt: new Date("2026-03-01T09:00:00Z"),
      mileageAtIntake: 84000,
      customerComplaint: "Akü değişecek",
      damageMarks: [
        { zone: "sol-on-kapi", damageType: "scratch", severity: "light", createdAt: new Date("2026-03-01T09:05:00Z") },
      ],
      order: {
        status: "delivered",
        arrivalReason: "maintenance",
        createdAt: new Date("2026-03-01T09:10:00Z"),
        itemNames: ["Akü 70Ah"],
      },
    },
  ],
}

test("maskesiz çıktıda bile para alanı bulunmaz", () => {
  const unlocked = buildCrossWorkshopHistory({
    plate: "34ABC123",
    rows: [FULL_ROW],
    accessReason: "registration_scan",
  })

  const offenders = collectKeys(unlocked).filter((k) =>
    MONEY_KEYS.some((needle) => k.toLowerCase().includes(needle))
  )
  expect(offenders).toEqual([])
})

test("maskeli çıktıda da para alanı bulunmaz", () => {
  const locked = buildCrossWorkshopHistory({ plate: "34ABC123", rows: [FULL_ROW], accessReason: null })
  const offenders = collectKeys(locked).filter((k) =>
    MONEY_KEYS.some((needle) => k.toLowerCase().includes(needle))
  )
  expect(offenders).toEqual([])
})

test("queries.ts para kolonu seçmez ve include ile geniş okuma yapmaz", () => {
  const source = readFileSync(join(import.meta.dir, "queries.ts"), "utf8")
  // Yorum satırlarını düş: dosya, yasağı ANLATAN yorumlar içeriyor.
  const code = source
    .split("\n")
    .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("//") && !line.trim().startsWith("/*"))
    .join("\n")
    .toLowerCase()

  const selectedMoney = MONEY_KEYS.filter((needle) => code.includes(`${needle}:`))
  expect(selectedMoney).toEqual([])
  // `include:` alan listesini gizler; bu dosyada yalnız `select:` kullanılır.
  expect(code).not.toContain("include:")
})
