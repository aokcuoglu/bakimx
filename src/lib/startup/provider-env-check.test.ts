import { test, expect } from "bun:test"
import { findMockProviders, checkProviderEnvAtStartup, buildProviderWarningBanner } from "./provider-env-check"

const env = (vars: Record<string, string | undefined>) => (name: string) => vars[name]

/** Hepsi gerçek sağlayıcıda olan bir ortam — testler tek tek bunu bozar. */
const allReal = {
  VIN_PROVIDER: "rapidapi",
  TECDOC_PROVIDER: "rapidapi",
  OCR_PROVIDER: "anthropic",
}

test("findMockProviders: flags unset, empty, and explicit mock; ignores real values", () => {
  const issues = findMockProviders(env({ ...allReal, VIN_PROVIDER: undefined }))
  expect(issues.map((i) => i.env)).toEqual(["VIN_PROVIDER"])
  expect(issues[0].value).toBe("(ayarsız)")

  expect(findMockProviders(env({ ...allReal, VIN_PROVIDER: "  MOCK ", TECDOC_PROVIDER: "" })).map((i) => i.env)).toEqual([
    "VIN_PROVIDER",
    "TECDOC_PROVIDER",
  ])

  expect(findMockProviders(env(allReal))).toEqual([])
})

test("findMockProviders: OCR da kapsanır (#256)", () => {
  expect(findMockProviders(env({ ...allReal, OCR_PROVIDER: undefined })).map((i) => i.env)).toEqual(["OCR_PROVIDER"])

  // Boş ortamda üçü birden yakalanmalı.
  expect(findMockProviders(env({})).map((i) => i.env)).toEqual([
    "VIN_PROVIDER",
    "TECDOC_PROVIDER",
    "OCR_PROVIDER",
  ])
})

test("checkProviderEnvAtStartup: silent in non-prod even when mock", () => {
  let warned = false
  let informed = false
  checkProviderEnvAtStartup({
    getEnv: env({}),
    isProd: false,
    warn: () => (warned = true),
    info: () => (informed = true),
  })
  expect(warned).toBe(false)
  expect(informed).toBe(false)
})

test("checkProviderEnvAtStartup: warns in prod when a provider is mock", () => {
  const msgs: string[] = []
  checkProviderEnvAtStartup({
    getEnv: env({ ...allReal, VIN_PROVIDER: undefined }),
    isProd: true,
    warn: (m) => msgs.push(m),
    info: () => {},
  })
  expect(msgs).toHaveLength(1)
  expect(msgs[0]).toContain("VIN_PROVIDER=(ayarsız)")
  expect(msgs[0]).toContain("RAPIDAPI_KEY")
})

test("checkProviderEnvAtStartup: info-only when all real in prod", () => {
  let warned = false
  const infos: string[] = []
  checkProviderEnvAtStartup({
    getEnv: env(allReal),
    isProd: true,
    warn: () => (warned = true),
    info: (m) => infos.push(m),
  })
  expect(warned).toBe(false)
  expect(infos[0]).toContain("vin=rapidapi")
  expect(infos[0]).toContain("tecdoc=rapidapi")
  expect(infos[0]).toContain("ocr=anthropic")
})

test("buildProviderWarningBanner: one bullet + one fix line per issue", () => {
  const banner = buildProviderWarningBanner(
    findMockProviders(env({ ...allReal, VIN_PROVIDER: undefined }))
  )
  expect(banner).toContain("Şaseden araç tanıma MOCK sağlayıcı kullanıyor")
  expect(banner).toContain("VIN_PROVIDER=rapidapi")
  expect(banner).toContain("RAPIDAPI_KEY=<anahtarınız>")
})

test("buildProviderWarningBanner: ipucu sağlayıcıya göre doğru anahtar/değeri verir (#256)", () => {
  const banner = buildProviderWarningBanner(findMockProviders(env({ ...allReal, OCR_PROVIDER: "mock" })))
  expect(banner).toContain("Ruhsat okuma (OCR) MOCK sağlayıcı kullanıyor")
  expect(banner).toContain("OCR_PROVIDER=anthropic")
  expect(banner).toContain("ANTHROPIC_API_KEY=<anahtarınız>")
  // Eskiden ipucu her değişken için rapidapi öneriyordu — OCR için yanlıştı.
  expect(banner).not.toContain("OCR_PROVIDER=rapidapi")
  expect(banner).not.toContain("RAPIDAPI_KEY")
})

test("buildProviderWarningBanner: aynı anahtarı paylaşan sağlayıcılarda anahtar satırı tekrarlamaz", () => {
  const banner = buildProviderWarningBanner(
    findMockProviders(env({ ...allReal, VIN_PROVIDER: "mock", TECDOC_PROVIDER: "mock" }))
  )
  expect(banner.match(/RAPIDAPI_KEY/g)).toHaveLength(1)
})
