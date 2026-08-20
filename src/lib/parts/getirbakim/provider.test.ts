import { afterEach, describe, expect, test } from "bun:test"
import { getGetirbakimProvider, parseGetirbakimProviderName, resetGetirbakimProvider } from "./provider"

/**
 * Sağlayıcı seçimi (BAK-183). En kritik iddia sonuncusu: GERÇEK ANAHTAR YOKKEN
 * hiçbir dış çağrı yapılmaz.
 */

const ENV_KEYS = [
  "GETIRBAKIM_PROVIDER",
  "GETIRBAKIM_API_KEY",
  "GETIRBAKIM_API_URL",
  "GETIRBAKIM_TIMEOUT_MS",
] as const

const original = new Map(ENV_KEYS.map((key) => [key, process.env[key]]))

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = original.get(key)
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  resetGetirbakimProvider()
})

describe("parseGetirbakimProviderName", () => {
  test("boş/tanımsız değer mock'a düşer", () => {
    expect(parseGetirbakimProviderName(undefined)).toBe("mock")
    expect(parseGetirbakimProviderName("")).toBe("mock")
    expect(parseGetirbakimProviderName("   ")).toBe("mock")
  })

  test("mock ve http tanınır, büyük/küçük harf önemsiz", () => {
    expect(parseGetirbakimProviderName("mock")).toBe("mock")
    expect(parseGetirbakimProviderName("http")).toBe("http")
    expect(parseGetirbakimProviderName("HTTP")).toBe("http")
    expect(parseGetirbakimProviderName(" Http ")).toBe("http")
  })

  test("bilinmeyen değer, ne yapılacağını söyleyen bir hata fırlatır", () => {
    expect(() => parseGetirbakimProviderName("https")).toThrow(/GETIRBAKIM_PROVIDER/)
  })
})

describe("getGetirbakimProvider", () => {
  test("varsayılan mock", () => {
    delete process.env.GETIRBAKIM_PROVIDER
    expect(getGetirbakimProvider().name).toBe("mock")
  })

  test("http + anahtar + url verilince http seçilir", () => {
    process.env.GETIRBAKIM_PROVIDER = "http"
    process.env.GETIRBAKIM_API_KEY = "sk_test_0123456789abcdef"
    process.env.GETIRBAKIM_API_URL = "https://getirbakim.example"
    expect(getGetirbakimProvider().name).toBe("http")
  })

  test("http istense de ANAHTAR yoksa sessizce mock'a düşer", () => {
    process.env.GETIRBAKIM_PROVIDER = "http"
    delete process.env.GETIRBAKIM_API_KEY
    process.env.GETIRBAKIM_API_URL = "https://getirbakim.example"
    expect(getGetirbakimProvider().name).toBe("mock")
  })

  test("http istense de URL yoksa sessizce mock'a düşer", () => {
    process.env.GETIRBAKIM_PROVIDER = "http"
    process.env.GETIRBAKIM_API_KEY = "sk_test_0123456789abcdef"
    delete process.env.GETIRBAKIM_API_URL
    expect(getGetirbakimProvider().name).toBe("mock")
  })

  test("seçim bir kez yapılır, tekrar çağrıda aynı örnek döner", () => {
    delete process.env.GETIRBAKIM_PROVIDER
    expect(getGetirbakimProvider()).toBe(getGetirbakimProvider())
  })
})

describe("mock sağlayıcı", () => {
  test("anahtar yokken HİÇBİR dış çağrı yapmaz", async () => {
    delete process.env.GETIRBAKIM_PROVIDER
    delete process.env.GETIRBAKIM_API_KEY

    const realFetch = globalThis.fetch
    let called = 0
    globalThis.fetch = (async () => {
      called += 1
      throw new Error("dış çağrı yapılmamalıydı")
    }) as typeof fetch

    try {
      const products = await getGetirbakimProvider().search({ q: "balata" })
      expect(called).toBe(0)
      expect(products.length).toBeGreaterThan(0)
    } finally {
      globalThis.fetch = realFetch
    }
  })

  test("serbest metin ad, kod ve marka üzerinde eşleşir", async () => {
    const provider = getGetirbakimProvider()
    expect((await provider.search({ q: "balata" })).length).toBeGreaterThan(0)
    expect((await provider.search({ q: "TRW" })).length).toBeGreaterThan(0)
    expect((await provider.search({ q: "GDB1330" })).length).toBeGreaterThan(0)
    expect(await provider.search({ q: "bulunmayan-parça-xyz" })).toEqual([])
  })

  test("OEM sorgusu ayraçtan bağımsız tam eşleşir", async () => {
    const provider = getGetirbakimProvider()
    const direct = await provider.search({ oem: "77362261" })
    expect(direct).toHaveLength(1)
    expect(direct[0]?.partNo).toBe("GDB1330")
    // Noktalama farkı eşleşmeyi bozmamalı.
    expect(await provider.search({ oem: "77-362 261" })).toHaveLength(1)
    expect(await provider.search({ oem: "yok-böyle-kod" })).toEqual([])
  })

  test("terimsiz sorgu boş döner", async () => {
    expect(await getGetirbakimProvider().search({})).toEqual([])
    expect(await getGetirbakimProvider().search({ q: "  " })).toEqual([])
  })

  test("limit sunucuda kırpılır", async () => {
    expect(await getGetirbakimProvider().search({ q: "a", limit: 1 })).toHaveLength(1)
  })
})
