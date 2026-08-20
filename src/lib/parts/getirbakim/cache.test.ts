import { afterEach, describe, expect, test } from "bun:test"
import {
  GETIRBAKIM_CACHE_MAX_ENTRIES,
  GETIRBAKIM_CACHE_TTL_MS,
  getirbakimCacheKey,
  readGetirbakimCache,
  resetGetirbakimCache,
  writeGetirbakimCache,
} from "./cache"
import type { GetirbakimProduct } from "./types"

const PRODUCT = { id: "1", name: "Balata" } as GetirbakimProduct

afterEach(resetGetirbakimCache)

describe("getirbakimCacheKey", () => {
  test("aynı sorgu aynı anahtarı üretir; büyük/küçük harf ve boşluk önemsiz", () => {
    expect(getirbakimCacheKey({ q: " Balata ", limit: 10 })).toBe(
      getirbakimCacheKey({ q: "balata", limit: 10 }),
    )
  })

  test("limit anahtarın parçası — 5 sonuçlu cevap 25'lik sorguyu karşılamaz", () => {
    expect(getirbakimCacheKey({ q: "balata", limit: 5 })).not.toBe(
      getirbakimCacheKey({ q: "balata", limit: 25 })
    )
  })

  test("oem ve q ayrı anahtar üretir", () => {
    expect(getirbakimCacheKey({ oem: "ABC", limit: 10 })).not.toBe(
      getirbakimCacheKey({ q: "ABC", limit: 10 }),
    )
  })
})

describe("cache okuma/yazma", () => {
  test("yazılan değer TTL içinde okunur", () => {
    const now = 1_000_000
    writeGetirbakimCache("k", [PRODUCT], now)
    expect(readGetirbakimCache("k", now + GETIRBAKIM_CACHE_TTL_MS - 1)).toEqual([PRODUCT])
  })

  test("TTL dolduğunda okunmaz — bayat fiyat gösterilmez", () => {
    const now = 1_000_000
    writeGetirbakimCache("k", [PRODUCT], now)
    expect(readGetirbakimCache("k", now + GETIRBAKIM_CACHE_TTL_MS)).toBeNull()
    // Süresi geçen giriş temizlenir, bellekte birikmez.
    expect(readGetirbakimCache("k", now)).toBeNull()
  })

  test("yazılmamış anahtar null döner", () => {
    expect(readGetirbakimCache("hiç")).toBeNull()
  })

  test("boş sonuç da saklanır — tekrar dış çağrı yapılmasın", () => {
    const now = 1_000_000
    writeGetirbakimCache("k", [], now)
    expect(readGetirbakimCache("k", now + 1)).toEqual([])
  })

  test("sınıra gelindiğinde en eski giriş atılır", () => {
    const now = 1_000_000
    for (let i = 0; i < GETIRBAKIM_CACHE_MAX_ENTRIES; i += 1) {
      writeGetirbakimCache(`k${i}`, [PRODUCT], now)
    }
    writeGetirbakimCache("yeni", [PRODUCT], now)
    expect(readGetirbakimCache("k0", now + 1)).toBeNull()
    expect(readGetirbakimCache("yeni", now + 1)).toEqual([PRODUCT])
  })

  test("var olan anahtarı tazelemek başka girişi atmaz", () => {
    const now = 1_000_000
    for (let i = 0; i < GETIRBAKIM_CACHE_MAX_ENTRIES; i += 1) {
      writeGetirbakimCache(`k${i}`, [PRODUCT], now)
    }
    writeGetirbakimCache("k5", [PRODUCT], now)
    expect(readGetirbakimCache("k0", now + 1)).toEqual([PRODUCT])
  })
})
