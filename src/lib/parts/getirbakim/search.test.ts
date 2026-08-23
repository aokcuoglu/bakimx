import { afterEach, expect, mock, test } from "bun:test"

mock.module("server-only", () => ({}))

import { resetGetirbakimCache } from "./cache"

afterEach(resetGetirbakimCache)

test("mock OEM araması stoklu GetirBakım ürününü döner", async () => {
  const { searchGetirbakimProducts } = await import("./search")
  const products = await searchGetirbakimProducts({ oem: "GDB1330" })
  expect(products.some((p) => p.id === "gb-1001")).toBe(true)
})

test("kalem yazımı ürünü sku + id ile yeniden çözer", async () => {
  const { resolveGetirbakimProduct } = await import("./search")
  const product = await resolveGetirbakimProduct("gb-1001", "GDB1330")
  expect(product?.id).toBe("gb-1001")
  expect(product?.b2bPriceKurus).toBe(160650)
})

test("yanlış id aynı parça no ile eşleşmez", async () => {
  const { resolveGetirbakimProduct } = await import("./search")
  expect(await resolveGetirbakimProduct("gb-yok", "GDB1330")).toBeNull()
})
