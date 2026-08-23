import { describe, expect, test } from "bun:test"
import { resolveProcurementProviderConfig } from "./provider"

const productionHttp = {
  NODE_ENV: "production",
  GETIRBAKIM_PROVIDER: "http",
  GETIRBAKIM_API_URL: "https://getirbakim.example",
  GETIRBAKIM_API_KEY: "test-api-key",
}

describe("resolveProcurementProviderConfig", () => {
  test("development'ta varsayılan mock istemciyi korur", () => {
    expect(resolveProcurementProviderConfig({ NODE_ENV: "development" })).toEqual({ name: "mock" })
  })

  test("production'da geçerli http yapılandırmasını kabul eder", () => {
    expect(resolveProcurementProviderConfig(productionHttp)).toEqual({
      name: "http",
      baseUrl: "https://getirbakim.example",
      apiKey: "test-api-key",
    })
  })

  test("production'da mock sağlayıcıyı reddeder", () => {
    expect(() => resolveProcurementProviderConfig({
      ...productionHttp,
      GETIRBAKIM_PROVIDER: "mock",
    })).toThrow(/http in production/)
  })

  test("production'da eksik sağlayıcıyı reddeder", () => {
    expect(() => resolveProcurementProviderConfig({
      ...productionHttp,
      GETIRBAKIM_PROVIDER: undefined,
    })).toThrow(/http in production/)
  })

  test("production'da eksik API key ile mock'a düşmez", () => {
    expect(() => resolveProcurementProviderConfig({
      ...productionHttp,
      GETIRBAKIM_API_KEY: undefined,
    })).toThrow(/configuration is unavailable/)
  })

  test("production'da eksik URL ile mock'a düşmez", () => {
    expect(() => resolveProcurementProviderConfig({
      ...productionHttp,
      GETIRBAKIM_API_URL: undefined,
    })).toThrow(/configuration is unavailable/)
  })

  test("production'da geçersiz veya HTTP dışı URL'yi reddeder", () => {
    expect(() => resolveProcurementProviderConfig({
      ...productionHttp,
      GETIRBAKIM_API_URL: "not-a-url",
    })).toThrow(/configuration is unavailable/)
    expect(() => resolveProcurementProviderConfig({
      ...productionHttp,
      GETIRBAKIM_API_URL: "ftp://getirbakim.example",
    })).toThrow(/configuration is unavailable/)
  })
})
