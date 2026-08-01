import { expect, test } from "bun:test"
import {
  MAX_BATCH_PHOTOS,
  describeUploadFailure,
  selectPhotoFiles,
} from "@/lib/photos/select-photo-files"

function makeFile(name: string, size = 10, lastModified = 1): File {
  const file = new File([new Uint8Array(size)], name, { type: "image/jpeg" })
  Object.defineProperty(file, "lastModified", { value: lastModified })
  return file
}

// ---------------------------------------------------------------------------
// selectPhotoFiles — biriktirme

test("boş listeye çoklu seçim tümünü kabul eder", () => {
  const incoming = [makeFile("a.jpg"), makeFile("b.jpg"), makeFile("c.jpg")]
  const result = selectPhotoFiles([], incoming)
  expect(result.accepted).toEqual(incoming)
  expect(result.duplicates).toBe(0)
  expect(result.overflow).toBe(0)
})

test("ikinci seçim mevcut listenin üzerine eklenir (değiştirmez)", () => {
  const current = [makeFile("a.jpg")]
  const result = selectPhotoFiles(current, [makeFile("b.jpg")])
  expect(result.accepted.map((f) => f.name)).toEqual(["b.jpg"])
})

test("aynı dosya tekrar seçilirse yinelenen sayılır", () => {
  const current = [makeFile("a.jpg", 10, 1)]
  const result = selectPhotoFiles(current, [makeFile("a.jpg", 10, 1), makeFile("b.jpg")])
  expect(result.accepted.map((f) => f.name)).toEqual(["b.jpg"])
  expect(result.duplicates).toBe(1)
})

test("aynı ad farklı boyut/tarih ise ayrı dosya sayılır", () => {
  const current = [makeFile("IMG_0001.jpg", 10, 1)]
  const result = selectPhotoFiles(current, [
    makeFile("IMG_0001.jpg", 20, 1),
    makeFile("IMG_0001.jpg", 10, 2),
  ])
  expect(result.accepted).toHaveLength(2)
  expect(result.duplicates).toBe(0)
})

test("tek seçim içindeki yinelenenler de elenir", () => {
  const result = selectPhotoFiles([], [makeFile("a.jpg"), makeFile("a.jpg")])
  expect(result.accepted).toHaveLength(1)
  expect(result.duplicates).toBe(1)
})

test("limit dolduğunda kalanlar overflow'a düşer", () => {
  const current = Array.from({ length: MAX_BATCH_PHOTOS - 1 }, (_, i) => makeFile(`c${i}.jpg`))
  const result = selectPhotoFiles(current, [makeFile("x.jpg"), makeFile("y.jpg")])
  expect(result.accepted.map((f) => f.name)).toEqual(["x.jpg"])
  expect(result.overflow).toBe(1)
})

test("liste zaten doluysa hiçbir dosya kabul edilmez", () => {
  const current = Array.from({ length: 2 }, (_, i) => makeFile(`c${i}.jpg`))
  const result = selectPhotoFiles(current, [makeFile("x.jpg")], 2)
  expect(result.accepted).toHaveLength(0)
  expect(result.overflow).toBe(1)
})

test("girdi listesi mutasyona uğramaz", () => {
  const current = [makeFile("a.jpg")]
  selectPhotoFiles(current, [makeFile("b.jpg")])
  expect(current).toHaveLength(1)
})

// ---------------------------------------------------------------------------
// describeUploadFailure

test("hata yoksa boş metin döner", () => {
  expect(describeUploadFailure([], 3)).toBe("")
})

test("kısmi başarıda kaç tanesinin yüklendiği belirtilir", () => {
  const message = describeUploadFailure(["b.jpg"], 3)
  expect(message).toContain("2 fotoğraf yüklendi")
  expect(message).toContain("1 fotoğraf yüklenemedi")
  expect(message).toContain("b.jpg")
})

test("tümü başarısızsa başarı ön eki eklenmez", () => {
  const message = describeUploadFailure(["a.jpg", "b.jpg"], 2)
  expect(message).not.toContain("yüklendi.")
  expect(message).toContain("2 fotoğraf yüklenemedi")
})

test("üçten fazla dosya adı kısaltılır", () => {
  const message = describeUploadFailure(["a.jpg", "b.jpg", "c.jpg", "d.jpg", "e.jpg"], 5)
  expect(message).toContain("a.jpg, b.jpg, c.jpg")
  expect(message).toContain("2 dosya daha")
  expect(message).not.toContain("d.jpg")
})
