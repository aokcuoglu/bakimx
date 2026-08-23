import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { groupPurchasePhotos, type PurchasePhotoInput } from "./purchase-photos"

/**
 * BAK-111: dış alım fotoğrafı teknisyen ekranında kalem kartında gösterilir.
 * Buradaki iki kural TypeScript'e de lint'e de takılmaz, o yüzden testle tutulur:
 * kaynağın `/api/photos` proxy'si olması (ham `fileUrl` üretimde 403) ve
 * dosyasız kaydın gruba hiç girmemesi (kartta boş kutu oluşmasın).
 */

function photo(over: Partial<PurchasePhotoInput> = {}): PurchasePhotoInput {
  return { id: "p1", fileUrl: "parts/box.jpg", note: null, serviceOrderItemId: "item-1", ...over }
}

test("kaleme bağlı olmayan (galeri) kareler gruba girmez", () => {
  const grouped = groupPurchasePhotos([
    photo({ id: "gallery", serviceOrderItemId: null }),
    photo({ id: "purchase", serviceOrderItemId: "item-1" }),
  ])

  expect([...grouped.keys()]).toEqual(["item-1"])
  expect(grouped.get("item-1")?.map((p) => p.id)).toEqual(["purchase"])
})

test("aynı kalemin birden çok karesi sırasını koruyarak birlikte gelir", () => {
  const grouped = groupPurchasePhotos([
    photo({ id: "a", serviceOrderItemId: "item-1" }),
    photo({ id: "b", serviceOrderItemId: "item-2" }),
    photo({ id: "c", serviceOrderItemId: "item-1" }),
  ])

  expect(grouped.get("item-1")?.map((p) => p.id)).toEqual(["a", "c"])
  expect(grouped.get("item-2")?.map((p) => p.id)).toEqual(["b"])
})

test("dosyası olmayan kare gruba girmez — kalemin anahtarı hiç oluşmaz", () => {
  const grouped = groupPurchasePhotos([photo({ id: "no-file", fileUrl: null })])

  expect(grouped.has("item-1")).toBe(false)
  expect(grouped.size).toBe(0)
})

test("kaynak ham fileUrl değil, oturum doğrulayan /api/photos proxy'sidir", () => {
  const grouped = groupPurchasePhotos([photo({ id: "p1", fileUrl: "workshops/1/parts/box.jpg" })])

  const src = grouped.get("item-1")?.[0].src
  expect(src).toBe("/api/photos?id=p1")
  expect(src).not.toContain("workshops/1/parts/box.jpg")
})

test("mock sağlayıcının data: URL'i olduğu gibi kullanılır", () => {
  const grouped = groupPurchasePhotos([photo({ fileUrl: "data:image/png;base64,AAA" })])

  expect(grouped.get("item-1")?.[0].src).toBe("data:image/png;base64,AAA")
})

test("not alanı taşınır — lightbox altında okunabilsin", () => {
  const grouped = groupPurchasePhotos([photo({ note: "Fiş arkada" })])

  expect(grouped.get("item-1")?.[0].note).toBe("Fiş arkada")
})

/**
 * Alış kareleri onarım galerilerinden BİLEREK dışlanır (dahili-yalnız). İki
 * filtre birbirinin tümleyeni olmalı: aynı kare ikisinde birden görünmemeli,
 * hiçbirinde görünmemezlik de olmamalı.
 */
test("galeri filtresi ile grup filtresi birbirinin tümleyenidir", () => {
  const photos = [
    photo({ id: "gallery-1", serviceOrderItemId: null }),
    photo({ id: "purchase-1", serviceOrderItemId: "item-1" }),
    photo({ id: "purchase-2", serviceOrderItemId: "item-2" }),
  ]

  const galleryIds = photos.filter((p) => p.serviceOrderItemId == null).map((p) => p.id)
  const groupedIds = [...groupPurchasePhotos(photos).values()].flat().map((p) => p.id)

  expect(galleryIds).toEqual(["gallery-1"])
  expect(groupedIds.sort()).toEqual(["purchase-1", "purchase-2"])
  expect(galleryIds.some((id) => groupedIds.includes(id))).toBe(false)
  expect(galleryIds.length + groupedIds.length).toBe(photos.length)
})

const DETAIL_SOURCE = readFileSync(
  join(import.meta.dir, "../../components/technician/technician-order-detail.tsx"),
  "utf8"
)

test("teknisyen ekranı dış alım karelerini bu yardımcıdan okur", () => {
  expect(DETAIL_SOURCE).toContain("groupPurchasePhotos(order.photos)")
})

test("fotoğrafı olmayan kalemde görsel alanı hiç açılmaz", () => {
  expect(DETAIL_SOURCE).toContain("photos.length > 0 ? <PurchasePhotoStrip")
})

const LIGHTBOX_SOURCE = readFileSync(
  join(import.meta.dir, "../../components/shared/photo-lightbox.tsx"),
  "utf8"
)

test("lightbox geri tuşuyla da kapanır ve Next'in geçmiş durumunu ezmez", () => {
  expect(LIGHTBOX_SOURCE).toContain('window.addEventListener("popstate"')
  expect(LIGHTBOX_SOURCE).toContain("{ ...window.history.state, bakimxLightbox: true }")
})

test("fotoğraf görüntüleyici tam ekran değil, ortada Dialog + Carousel açılır", () => {
  expect(LIGHTBOX_SOURCE).toContain("DialogContent")
  expect(LIGHTBOX_SOURCE).toContain("<Carousel")
  expect(LIGHTBOX_SOURCE).toContain("cursor-zoom-in")
  expect(LIGHTBOX_SOURCE).not.toContain("bg-black/95")
  expect(LIGHTBOX_SOURCE).not.toContain("framer-motion")
})
