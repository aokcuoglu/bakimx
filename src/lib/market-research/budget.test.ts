import { expect, test } from "bun:test"
import { estimateSonnetCostMicroUsd, monthlyRequestLimitReached, workshopMonthlyQuotaReached } from "./budget"

test("Anthropic usage değerini USD mikro-birim olarak yukarı yuvarlar", () => {
  expect(estimateSonnetCostMicroUsd({
    input_tokens: 1_000,
    cache_creation_input_tokens: 500,
    cache_read_input_tokens: 2_000,
    output_tokens: 100,
    server_tool_use: { web_search_requests: 3 },
  })).toEqual({ costMicroUsd: 36_600, webSearches: 3 })
})

test("tek probe limiti tamamlanmış veya devam eden ikinci çağrıyı keser", () => {
  expect(monthlyRequestLimitReached(0, 0n, 1)).toBe(false)
  expect(monthlyRequestLimitReached(1, 0n, 1)).toBe(true)
  expect(monthlyRequestLimitReached(0, 750_000n, 1)).toBe(true)
  expect(monthlyRequestLimitReached(20, 0n)).toBe(false)
})

test("şirket kotası başarılı ve devam eden atomik slotları birlikte sayar", () => {
  expect(workshopMonthlyQuotaReached(28, 1)).toBe(false)
  expect(workshopMonthlyQuotaReached(29, 1)).toBe(true)
  expect(workshopMonthlyQuotaReached(30, 0)).toBe(true)
})
