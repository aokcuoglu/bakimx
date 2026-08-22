import { test, expect } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { resolvePhotoSrc } from "./photo-src"

const SRC_ROOT = join(import.meta.dir, "../..")

test("depo referansı asla doğrudan kullanılmaz, proxy'ye çevrilir", () => {
  expect(
    resolvePhotoSrc({ id: "ph1", fileUrl: "https://bakimx-media.s3.eu-central-1.amazonaws.com/workshops/w1/a.jpg" })
  ).toBe("/api/photos?id=ph1")
})

test("MinIO endpoint biçimindeki referans da proxy'ye çevrilir", () => {
  expect(resolvePhotoSrc({ id: "ph2", fileUrl: "http://localhost:9000/bakimx/workshops/w1/a.jpg" })).toBe(
    "/api/photos?id=ph2"
  )
})

test("mock sağlayıcının data: URL'i olduğu gibi kullanılır", () => {
  const dataUrl = "data:image/jpeg;base64,AAAA"
  expect(resolvePhotoSrc({ id: "ph3", fileUrl: dataUrl })).toBe(dataUrl)
})

test("dosyası olmayan kayıt null döner", () => {
  expect(resolvePhotoSrc({ id: "ph4", fileUrl: null })).toBeNull()
})

test("id sorgu dizesine güvenli kodlanır", () => {
  expect(resolvePhotoSrc({ id: "a b&c", fileUrl: "https://example.com/a.jpg" })).toBe("/api/photos?id=a%20b%26c")
})

/**
 * Araç detayı / pasaport geçmişi üretimde boş kutu gösteriyordu: ham `fileUrl`
 * S3 referansıdır ve 403 döner. Kanıt sekmesi `resolvePhotoSrc` kullanır; bu
 * iki personel yüzeyi de aynı sözleşmeyi tutmak zorunda. TypeScript yakalamaz.
 */
test("araç fotoğraf ızgarası ham fileUrl basmaz, proxy + modal carousel kullanır", () => {
  const grid = readFileSync(join(SRC_ROOT, "components/vehicles/vehicle-photo-history.tsx"), "utf8")
  expect(grid).toContain("resolvePhotoSrc")
  expect(grid).toContain("PhotoLightbox")
  expect(grid).not.toMatch(/src=\{p\.fileUrl\}/)
  expect(grid).not.toMatch(/src=\{photo\.fileUrl\}/)
  expect(grid).not.toContain("/orders/")
})

for (const file of [
  "components/vehicles/vehicle-detail.tsx",
  "components/vehicles/vehicle-passport.tsx",
] as const) {
  test(`${file} fotoğraf geçmişini paylaşılan ızgaradan açar`, () => {
    const source = readFileSync(join(SRC_ROOT, file), "utf8")
    expect(source).toContain("VehiclePhotoGrid")
    expect(source).not.toMatch(/src=\{p\.fileUrl\}/)
  })
}
