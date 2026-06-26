import { test, expect } from "bun:test"
import { buildModelQuery } from "./model-search"

test("base query filters by brandId, caps at 100, orders by name", () => {
  expect(buildModelQuery({ brandId: 2 })).toEqual({
    where: { brandId: 2 },
    select: { id: true, name: true },
    take: 100,
    orderBy: { name: "asc" },
  })
})

test("adds case-insensitive name contains when q present", () => {
  const q = buildModelQuery({ brandId: 2, q: "corsa" })
  expect(q.where).toEqual({ brandId: 2, name: { contains: "corsa", mode: "insensitive" } })
})

test("ignores blank q and clamps limit to 200", () => {
  const q = buildModelQuery({ brandId: 2, q: "   ", limit: 9999 })
  expect(q.where).toEqual({ brandId: 2 })
  expect(q.take).toBe(200)
})
