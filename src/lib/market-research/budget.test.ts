import { expect, test } from "bun:test"
import { estimateSonnetCostMicroUsd } from "./budget"

test("Anthropic usage değerini USD mikro-birim olarak yukarı yuvarlar", () => {
  expect(estimateSonnetCostMicroUsd({
    input_tokens: 1_000,
    cache_creation_input_tokens: 500,
    cache_read_input_tokens: 2_000,
    output_tokens: 100,
    server_tool_use: { web_search_requests: 3 },
  })).toEqual({ costMicroUsd: 36_600, webSearches: 3 })
})
