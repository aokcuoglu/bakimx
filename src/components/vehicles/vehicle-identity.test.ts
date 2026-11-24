import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const read = (file: string) => readFileSync(join(import.meta.dir, file), "utf8")

/**
 * Araç detayı/düzenleme başlığı (`VehicleIdentity`) ile servis pasaportu başlığı
 * aynı düzeni paylaşır (plaka + `h2 text-lg sm:text-xl`). İkisi eskiden aynı
 * 32px `PlateBadge`'i çiziyordu; `Plate`'e geçerken farklı boylara düşüp sayfa
 * değişince plaka zıplıyordu (#818 incelemesi). Aynı boyda kalmalılar.
 */
test("araç detayı ve servis pasaportu başlığında plaka aynı boyda", () => {
  expect(read("vehicle-identity.tsx")).toContain('<Plate plate={plate} size="lg" />')
  expect(read("vehicle-passport.tsx")).toContain('<Plate plate={vehicle.plate} size="lg" />')
})
