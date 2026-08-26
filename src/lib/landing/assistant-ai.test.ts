import { afterEach, describe, expect, test } from "bun:test"
import { resetLandingAssistantProvider } from "@/lib/landing/assistant-provider"
import { askLandingAssistant } from "./assistant-ai"

afterEach(() => {
  process.env.AI_PROVIDER = "mock"
  resetLandingAssistantProvider()
})

describe("landing AI — grounded mock", () => {
  test("corpus'taki soruya tek cevap ve görünür kaynak döner", async () => {
    process.env.AI_PROVIDER = "mock"
    resetLandingAssistantProvider()
    const result = await askLandingAssistant("stok takibi nasıl çalışıyor?")

    expect(result?.answer).toContain("stok")
    expect(result?.sources.map((source) => source.id)).toEqual(["stok-dusumu"])
  })

  test("olmayan özellik sorusunda cevap uydurmaz", async () => {
    process.env.AI_PROVIDER = "mock"
    resetLandingAssistantProvider()

    expect(await askLandingAssistant("Muhasebe programına otomatik e-fatura kesiyor musunuz?")).toBeNull()
  })
})
