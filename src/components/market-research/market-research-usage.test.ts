import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { formatMarketResearchCost } from "./market-research-usage"
import { marketResearchCredentialSchema } from "@/lib/validations/market-research"

const source = readFileSync(new URL("./market-research-usage.tsx", import.meta.url), "utf8")

describe("piyasa araştırması kullanım görünümü", () => {
  test("micro USD değerini kullanıcıya USD olarak sunar", () => {
    expect(formatMarketResearchCost(1_250_000)).toContain("1,25")
  })

  test("kısa veya boş API anahtarını istemcide reddeder", () => {
    expect(marketResearchCredentialSchema.safeParse({ apiKey: "" }).success).toBe(false)
    expect(marketResearchCredentialSchema.safeParse({ apiKey: "sk-ant-test-key-that-is-long-enough" }).success).toBe(true)
  })

  test("anahtarın yeniden gösterilmediğini ve silmenin onay istediğini açıklar", () => {
    expect(source).toContain("bir daha gösterilmez")
    expect(source).toContain("AlertDialog")
    expect(source).not.toContain("credential.apiKey")
  })

  test("platform ve şirket harcamasını ayrı gösterir", () => {
    expect(source).toContain("platformCostMicroUsd")
    expect(source).toContain("byokCostMicroUsd")
    expect(source).toContain("Şirket anahtarı")
  })
})
