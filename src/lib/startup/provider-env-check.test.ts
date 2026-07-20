import { test, expect } from "bun:test"
import { findMockProviders, checkProviderEnvAtStartup, buildProviderWarningBanner } from "./provider-env-check"

const env = (vars: Record<string, string | undefined>) => (name: string) => vars[name]

test("findMockProviders: flags unset, empty, and explicit mock; ignores rapidapi", () => {
  const issues = findMockProviders(env({ VIN_PROVIDER: undefined, TECDOC_PROVIDER: "rapidapi" }))
  expect(issues.map((i) => i.env)).toEqual(["VIN_PROVIDER"])
  expect(issues[0].value).toBe("(ayarsız)")

  expect(findMockProviders(env({ VIN_PROVIDER: "  MOCK ", TECDOC_PROVIDER: "" })).map((i) => i.env)).toEqual([
    "VIN_PROVIDER",
    "TECDOC_PROVIDER",
  ])

  expect(findMockProviders(env({ VIN_PROVIDER: "rapidapi", TECDOC_PROVIDER: "rapidapi" }))).toEqual([])
})

test("checkProviderEnvAtStartup: silent in non-prod even when mock", () => {
  let warned = false
  let informed = false
  checkProviderEnvAtStartup({
    getEnv: env({ VIN_PROVIDER: undefined, TECDOC_PROVIDER: undefined }),
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
    getEnv: env({ VIN_PROVIDER: undefined, TECDOC_PROVIDER: "rapidapi" }),
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
    getEnv: env({ VIN_PROVIDER: "rapidapi", TECDOC_PROVIDER: "rapidapi" }),
    isProd: true,
    warn: () => (warned = true),
    info: (m) => infos.push(m),
  })
  expect(warned).toBe(false)
  expect(infos[0]).toContain("vin=rapidapi")
  expect(infos[0]).toContain("tecdoc=rapidapi")
})

test("buildProviderWarningBanner: one bullet + one fix line per issue", () => {
  const banner = buildProviderWarningBanner([{ env: "VIN_PROVIDER", label: "VIN'den araç tanıma", value: "(ayarsız)" }])
  expect(banner).toContain("VIN'den araç tanıma MOCK sağlayıcı kullanıyor")
  expect(banner).toContain("VIN_PROVIDER=rapidapi")
})
