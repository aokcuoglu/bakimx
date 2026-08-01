import { test, expect } from "bun:test"
import { MockStorageProvider } from "./mock-storage-provider"

// Regresyon: sağlayıcı tarayıcıya özgü `FileReader`'ı kullanıyordu ve sunucuda
// çalıştığı için her dosyalı fotoğraf yüklemesi "FileReader is not defined" ile
// düşüyordu. Bu testler Node runtime'ında (bun test) koşar; tarayıcı API'si
// yeniden sızarsa burada kırılır.

test("dosya sunucu tarafında data URL'ye çevrilir", async () => {
  const provider = new MockStorageProvider()
  const file = new File(["merhaba"], "km.png", { type: "image/png" })

  const { url, key } = await provider.upload(file, "workshops/w1/km.png")

  expect(key).toBe("workshops/w1/km.png")
  expect(url).toBe(`data:image/png;base64,${Buffer.from("merhaba").toString("base64")}`)
})

test("mime tipi bilinmiyorsa genel tipe düşer", async () => {
  const provider = new MockStorageProvider()
  const file = new File(["x"], "bilinmeyen")

  const { url } = await provider.upload(file, "k1")

  expect(url.startsWith("data:application/octet-stream;base64,")).toBe(true)
})

test("yüklenen içerik anahtarla geri okunur, silinince kaybolur", async () => {
  const provider = new MockStorageProvider()
  const { key, url } = await provider.upload(new File(["x"], "a.png", { type: "image/png" }), "k2")

  expect(await provider.getSignedUrl(key)).toBe(url)

  await provider.delete(key)
  expect(await provider.getSignedUrl(key)).toBe("")
})
