import { afterEach, describe, expect, test } from "bun:test"
import { HttpGetirbakimProvider } from "./http-getirbakim-provider"

/**
 * HTTP sağlayıcısının DÜŞÜŞ sözleşmesi (BAK-183): hiçbir koşulda fırlatmaz,
 * en kötü ihtimalle boş liste döner. GetirBakım düştüğünde atölyenin parça
 * arama akışı da düşerse, hiç entegre etmemekten kötü olur.
 */

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

function provider(timeoutMs = 4000) {
  return new HttpGetirbakimProvider("https://getirbakim.example/", "sk_test_key_0123456789", timeoutMs)
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("HttpGetirbakimProvider", () => {
  test("exact offer sorgusunu partNo ile yapar ve sunum contractını döndürür", async () => {
    let seenUrl = ""
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      seenUrl = String(input)
      return jsonResponse({ products: [
        {
          sourceProductId: "168993", brandName: "Marka A",
          manufacturerPartNumber: { value: "103803", normalized: "103803" },
          offers: [{ supplierDisplayName: "Dinamik", informationalPriceKurus: 99530, currency: "TRY", vatRateBps: 2000, availability: "UNKNOWN", stockQty: null, lastSyncedAt: null }],
        },
        {
          sourceProductId: "168994", brandName: "Marka B",
          manufacturerPartNumber: { value: "103803", normalized: "103803" }, offers: [],
        },
      ] })
    }) as typeof fetch
    const result = await provider().findOffersByPartNo("103803")
    expect(seenUrl).toContain("partNo=103803")
    expect(seenUrl).not.toContain("limit=")
    expect(result.status).toBe("matched")
    if (result.status === "matched") {
      expect(result.products.map((product) => product.sourceProductId)).toEqual(["168993", "168994"])
      expect(result.products.map((product) => product.brandName)).toEqual(["Marka A", "Marka B"])
    }
  })

  test("exact offer sorgusunda upstream hata fırlatılır; arama düşüşü değişmez", async () => {
    globalThis.fetch = (async () => jsonResponse({}, 502)) as typeof fetch
    expect(provider().findOffersByPartNo("103803")).rejects.toThrow("HTTP 502")
    expect(await provider().search({ q: "103803" })).toEqual([])
  })

  test("başarılı yanıtı DTO'ya çevirir", async () => {
    globalThis.fetch = (async () =>
      jsonResponse({
        products: [
          {
            id: "1",
            partNo: "GDB1330",
            name: "Fren Balatası",
            brandName: "TRW",
            categoryName: "Fren",
            oemNumbers: ["77362261"],
            imageUrl: null,
            listPriceKurus: 20000,
            b2bPriceKurus: 17000,
            discountBps: 1500,
            vatRateBps: 2000,
            currency: "TRY",
            stockQty: 4,
            availability: "IN_STOCK",
            lastSyncedAt: "2026-08-20T06:00:00.000Z",
          },
        ],
      })) as typeof fetch

    const products = await provider().search({ q: "balata" })
    expect(products).toHaveLength(1)
    expect(products[0]?.b2bPriceKurus).toBe(17000)
    expect(products[0]?.availability).toBe("IN_STOCK")
  })

  test("anahtarı Authorization: Bearer ile gönderir ve oem'i q'ya tercih eder", async () => {
    let seenUrl = ""
    let seenAuth: string | null = null
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seenUrl = String(input)
      seenAuth = new Headers(init?.headers).get("Authorization")
      return jsonResponse({ products: [] })
    }) as typeof fetch

    await provider().search({ q: "balata", oem: "77362261", limit: 5 })
    expect(seenAuth).toBe("Bearer sk_test_key_0123456789")
    expect(seenUrl).toContain("/api/partner/v1/products?")
    expect(seenUrl).toContain("oem=77362261")
    expect(seenUrl).not.toContain("q=balata")
    // Taban URL'deki sondaki eğik çizgi çift eğik çizgiye dönmemeli.
    expect(seenUrl).not.toContain("example//api")
  })

  test("HTTP hatası boş listeye düşer, fırlatmaz", async () => {
    globalThis.fetch = (async () => jsonResponse({ error: "nope" }, 401)) as typeof fetch
    expect(await provider().search({ q: "balata" })).toEqual([])
  })

  test("ağ hatası boş listeye düşer", async () => {
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED")
    }) as typeof fetch
    expect(await provider().search({ q: "balata" })).toEqual([])
  })

  test("zaman aşımı boş listeye düşer", async () => {
    globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        // Gerçek fetch'in AbortSignal davranışını taklit et.
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("The operation timed out.", "TimeoutError")),
        )
      })) as typeof fetch

    expect(await provider(20).search({ q: "balata" })).toEqual([])
  })

  test("bozuk JSON boş listeye düşer", async () => {
    globalThis.fetch = (async () =>
      new Response("<html>502</html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      })) as typeof fetch
    expect(await provider().search({ q: "balata" })).toEqual([])
  })

  test("beklenmeyen gövde şekli boş listeye düşer", async () => {
    globalThis.fetch = (async () => jsonResponse({ products: "hepsi" })) as typeof fetch
    expect(await provider().search({ q: "balata" })).toEqual([])
  })

  test("zorunlu alanı eksik satır atılır, sağlam satır kalır", async () => {
    globalThis.fetch = (async () =>
      jsonResponse({
        products: [
          { partNo: "X", name: "id yok" },
          { id: "2", name: "Sağlam Satır" },
        ],
      })) as typeof fetch

    const products = await provider().search({ q: "balata" })
    expect(products).toHaveLength(1)
    expect(products[0]?.name).toBe("Sağlam Satır")
    // Eksik alanlar güvenli varsayılana düşer, undefined yüzeye çıkmaz.
    expect(products[0]?.currency).toBe("TRY")
    expect(products[0]?.stockQty).toBe(0)
    expect(products[0]?.availability).toBe("UNAVAILABLE")
    expect(products[0]?.b2bPriceKurus).toBeNull()
  })

  test("terimsiz sorguda hiç istek atılmaz", async () => {
    let called = 0
    globalThis.fetch = (async () => {
      called += 1
      return jsonResponse({ products: [] })
    }) as typeof fetch

    expect(await provider().search({})).toEqual([])
    expect(called).toBe(0)
  })
})
