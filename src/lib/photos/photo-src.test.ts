import { test, expect } from "bun:test"
import { resolvePhotoSrc } from "./photo-src"

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
