import { afterEach, beforeEach, expect, mock, setSystemTime, test } from "bun:test"

mock.module("server-only", () => ({}))

import { GETIRBAKIM_CACHE_TTL_MS, resetGetirbakimCache } from "./cache"
import { getirbakimLineItemFields } from "../getirbakim-item"
import { resetGetirbakimProvider } from "./provider"

/**
 * #739: zaman aşımına düşen bir GetirBakım araması "ürün yok" olarak önbelleğe
 * yazılmamalı; sonraki deneme yeniden sorgulamalı. Başarılı boş sonuç ise yazılır.
 */

const realFetch = globalThis.fetch
const savedEnv = {
  provider: process.env.GETIRBAKIM_PROVIDER,
  key: process.env.GETIRBAKIM_API_KEY,
  url: process.env.GETIRBAKIM_API_URL,
}

const product = {
  id: "1", partNo: "GDB1330", name: "Fren Balatası", brandName: "TRW", categoryName: "Fren",
  oemNumbers: [], imageUrl: null, listPriceKurus: 20000, b2bPriceKurus: 17000, discountBps: 1500,
  vatRateBps: 2000, currency: "TRY", stockQty: 4, availability: "IN_STOCK", lastSyncedAt: null,
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

beforeEach(() => {
  process.env.GETIRBAKIM_PROVIDER = "http"
  process.env.GETIRBAKIM_API_KEY = "sk_test_key_0123456789"
  process.env.GETIRBAKIM_API_URL = "https://getirbakim.example"
  resetGetirbakimProvider()
  resetGetirbakimCache()
})

afterEach(() => {
  globalThis.fetch = realFetch
  for (const [name, value] of [
    ["GETIRBAKIM_PROVIDER", savedEnv.provider],
    ["GETIRBAKIM_API_KEY", savedEnv.key],
    ["GETIRBAKIM_API_URL", savedEnv.url],
  ] as const) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
  resetGetirbakimProvider()
  resetGetirbakimCache()
})

test("zaman aşımı önbelleğe yazılmaz; sonraki arama ürünü getirir", async () => {
  const { searchGetirbakimProducts } = await import("./search")
  let calls = 0
  globalThis.fetch = (async () => {
    calls++
    if (calls === 1) throw new DOMException("The operation was aborted due to timeout", "TimeoutError")
    return jsonResponse({ products: [product] })
  }) as typeof fetch

  expect(await searchGetirbakimProducts({ q: "fren balatasi" })).toEqual([])
  const second = await searchGetirbakimProducts({ q: "fren balatasi" })
  expect(calls).toBe(2)
  expect(second.map((p) => p.partNo)).toEqual(["GDB1330"])
})

test("HTTP hatası önbelleğe yazılmaz", async () => {
  const { searchGetirbakimProducts } = await import("./search")
  let calls = 0
  globalThis.fetch = (async () => {
    calls++
    return calls === 1 ? jsonResponse({}, 503) : jsonResponse({ products: [product] })
  }) as typeof fetch

  expect(await searchGetirbakimProducts({ q: "balata" })).toEqual([])
  expect((await searchGetirbakimProducts({ q: "balata" })).length).toBe(1)
  expect(calls).toBe(2)
})

test("başarılı boş sonuç önbelleğe yazılır (tekrar dış çağrı yapılmaz)", async () => {
  const { searchGetirbakimProducts } = await import("./search")
  let calls = 0
  globalThis.fetch = (async () => {
    calls++
    return jsonResponse({ products: [] })
  }) as typeof fetch

  expect(await searchGetirbakimProducts({ q: "olmayan parca" })).toEqual([])
  expect(await searchGetirbakimProducts({ q: "olmayan parca" })).toEqual([])
  expect(calls).toBe(1)
})

test("GetirBakım'da değişen partner iskontosu TTL sonunda aramaya ve kalem alış fiyatına yansır (#760)", async () => {
  const { resolveGetirbakimProduct, searchGetirbakimProducts } = await import("./search")
  let discountBps = 0
  let calls = 0
  globalThis.fetch = (async () => {
    calls++
    // GetirBakım iskontoyu kendisi uygular; BakımX yalnız okur.
    const b2bPriceKurus = Math.round(20000 * (1 - discountBps / 10000))
    return jsonResponse({ products: [{ ...product, b2bPriceKurus, discountBps }] })
  }) as typeof fetch

  const start = new Date("2026-11-21T10:00:00Z")
  try {
    setSystemTime(start)
    const before = await searchGetirbakimProducts({ q: "fren balatasi" })
    expect(before[0].b2bPriceKurus).toBe(20000)
    expect(before[0].discountBps).toBe(0)

    discountBps = 1000 // panelde %10 tanımlandı
    setSystemTime(new Date(start.getTime() + GETIRBAKIM_CACHE_TTL_MS + 1))
    const after = await searchGetirbakimProducts({ q: "fren balatasi" })
    expect(after[0].b2bPriceKurus).toBe(18000)
    expect(after[0].discountBps).toBe(1000)

    // Kalem yazımı ürünü sağlayıcıdan yeniden çözer: alış = GetirBakım'ın iskontolu fiyatı, yerel hesap yok.
    const resolved = await resolveGetirbakimProduct("1", "GDB1330")
    expect(resolved).not.toBeNull()
    expect(getirbakimLineItemFields(resolved!).purchasePriceKurus).toBe(18000)
    expect(calls).toBeGreaterThanOrEqual(2)
  } finally {
    setSystemTime()
  }
})
