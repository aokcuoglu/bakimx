import { afterEach, expect, test } from "bun:test"
import {
  bakimxCategoriesUrl,
  bakimxSearchUrl,
  fetchBakimxCategories,
  fetchBakimxProducts,
  isBakimxGateLocked,
  resetBakimxGateCache,
} from "./bakimx-client"

/**
 * BAK-35 — `bakimxCatalog` kapısı KAPALI atölyede atölye yüzeyinin davranışı.
 *
 * Kabul kriteri: arama ve parça seçici hatasız çalışır, yalnız BakımX bölümü
 * görünmez. Bu dosya o davranışın istemci ayağını kilitler: 403 bir hata değil
 * "boş liste + kapı kapalı" bilgisidir, ve bir kez öğrenildikten sonra her tuş
 * vuruşunda yeniden 403 alınmaz.
 */

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
  resetBakimxGateCache()
})

/** Sahte fetch; çağrılan URL'leri kaydeder. */
function stubFetch(handler: (url: string) => { status: number; body?: unknown }) {
  const calls: string[] = []
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url)
    const { status, body } = handler(url)
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })
  }) as typeof fetch
  return calls
}

test("403 hata değil 'locked' döner ve bölüm boş kalır", async () => {
  stubFetch(() => ({ status: 403, body: { error: "kapalı", code: "feature_locked" } }))

  expect(await fetchBakimxProducts({ q: "aku" })).toEqual({ status: "locked" })
  expect(await fetchBakimxCategories()).toEqual({ status: "locked" })
  expect(isBakimxGateLocked()).toBe(true)
})

test("kapı bir kez kapalı görüldüğünde ağa TEKRAR çıkılmaz", async () => {
  const calls = stubFetch(() => ({ status: 403, body: { code: "feature_locked" } }))

  await fetchBakimxProducts({ q: "ak" })
  await fetchBakimxProducts({ q: "aku" })
  await fetchBakimxProducts({ q: "akü " })
  await fetchBakimxCategories()

  expect(calls).toHaveLength(1)
})

test("geçici hata kapıyı kapatmaz — sonraki sorgu yine denenir", async () => {
  let status = 500
  const calls = stubFetch(() => ({ status, body: { error: "patladı" } }))

  expect(await fetchBakimxProducts({ q: "aku" })).toEqual({ status: "error" })
  expect(isBakimxGateLocked()).toBe(false)

  status = 200
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ products: [{ id: "bx-1" }] }), { status: 200 })) as typeof fetch
  const ok = await fetchBakimxProducts({ q: "aku" })
  expect(ok.status).toBe("ok")
  expect(calls).toHaveLength(1)
})

test("ağ hatası sessizce 'error'a düşer — çağıran try/catch yazmak zorunda değil", async () => {
  globalThis.fetch = (async () => {
    throw new Error("offline")
  }) as typeof fetch
  expect(await fetchBakimxProducts({ q: "aku" })).toEqual({ status: "error" })
})

test("beklenmeyen gövde 'error' sayılır, undefined listeye düşülmez", async () => {
  stubFetch(() => ({ status: 200, body: { products: null } }))
  expect(await fetchBakimxProducts({ q: "aku" })).toEqual({ status: "error" })
})

test("başarılı yanıt ürünleri döner", async () => {
  stubFetch(() => ({ status: 200, body: { products: [{ id: "bx-1" }, { id: "bx-2" }] } }))
  const result = await fetchBakimxProducts({ q: "aku" })
  expect(result.status).toBe("ok")
  expect(result.status === "ok" && result.data).toHaveLength(2)
})

test("sorgu dizesi yalnız dolu parametreleri taşır", () => {
  expect(bakimxSearchUrl({ q: "aku", limit: 8 })).toBe("/api/catalog/bakimx/search?q=aku&limit=8")
  expect(bakimxSearchUrl({ categoryKey: "yag-filtresi" })).toBe(
    "/api/catalog/bakimx/search?categoryKey=yag-filtresi",
  )
  // Boş sorgu meşrudur: kategoriye tıklandığında dalın tamamı listelenir.
  expect(bakimxSearchUrl({ q: "" })).toBe("/api/catalog/bakimx/search?")
})

test("vehicleTypeId taşınır; araçsız çağrıda parametre hiç eklenmez (BAK-46)", () => {
  expect(bakimxSearchUrl({ q: "aku", vehicleTypeId: 42 })).toBe(
    "/api/catalog/bakimx/search?q=aku&vehicleTypeId=42",
  )
  expect(bakimxSearchUrl({ q: "aku", vehicleTypeId: null })).toBe("/api/catalog/bakimx/search?q=aku")

  // Taksonomi arama ile AYNI aracı görmeli, yoksa dolu görünen dal boş açılır.
  expect(bakimxCategoriesUrl(42)).toBe("/api/catalog/bakimx/categories?vehicleTypeId=42")
  expect(bakimxCategoriesUrl(null)).toBe("/api/catalog/bakimx/categories")
})
