import { afterEach, beforeEach, expect, mock, test } from "bun:test"

mock.module("server-only", () => ({}))

import { resetGetirbakimCache } from "./cache"
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
