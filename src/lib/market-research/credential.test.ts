import { describe, expect, test } from "bun:test"
import { decryptMarketResearchApiKey, encryptMarketResearchApiKey, validateAnthropicApiKey } from "./credential"

const env = (values: Record<string, string | undefined>) => (name: string) => values[name]
const keyEnv = env({ NODE_ENV: "production", MARKET_RESEARCH_CREDENTIAL_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64") })

describe("market research BYOK envelope", () => {
  test("AES-GCM zarfını açar ve düz anahtarı zarfa yazmaz", () => {
    const apiKey = "sk-ant-api03-super-secret-value"
    const envelope = encryptMarketResearchApiKey(apiKey, keyEnv)
    expect(envelope.startsWith("v1.")).toBe(true)
    expect(envelope).not.toContain(apiKey)
    expect(decryptMarketResearchApiKey(envelope, keyEnv)).toBe(apiKey)
  })

  test("kurcalanmış zarfı reddeder", () => {
    const envelope = encryptMarketResearchApiKey("sk-ant-api03-super-secret-value", keyEnv)
    const parts = envelope.split(".")
    parts[3] = `${parts[3]![0] === "A" ? "B" : "A"}${parts[3]!.slice(1)}`
    expect(() => decryptMarketResearchApiKey(parts.join("."), keyEnv)).toThrow()
  })

  test("production'da dedicated key yoksa fail-closed", () => {
    expect(() => encryptMarketResearchApiKey("sk-ant-api03-super-secret-value", env({ NODE_ENV: "production" }))).toThrow("production")
  })

  test("kısa veya boşluklu API anahtarını reddeder", () => {
    expect(() => validateAnthropicApiKey("short")).toThrow()
    expect(() => validateAnthropicApiKey("sk-ant-api03 with whitespace and enough length")).toThrow()
  })
})
