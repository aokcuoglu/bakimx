/**
 * Boot-time sanity check for the paid-provider env vars. Each of these silently
 * falls back to a mock/demo dataset when unset (see getVinProvider /
 * getTecdocProvider), so a missing var on the VPS makes real queries return
 * demo data with no error — exactly the "VIN katalogda bulunamadı" trap that bit
 * staging when .env.staging lacked VIN_PROVIDER. This surfaces the mismatch at
 * startup instead of on the first user query buried in the logs.
 */

/** Provider vars that resolve to a mock/demo provider when unset or "mock". */
const PROVIDER_VARS = [
  { env: "VIN_PROVIDER", label: "VIN'den araç tanıma" },
  { env: "TECDOC_PROVIDER", label: "TecDoc parça kataloğu" },
] as const

export interface ProviderEnvIssue {
  env: string
  label: string
  /** The raw (lowercased) value, or "(ayarsız)" when absent/empty. */
  value: string
}

export type EnvReader = (name: string) => string | undefined

const defaultEnv: EnvReader = (name) => process.env[name]

/** Pure: the provider vars that currently resolve to the mock provider. */
export function findMockProviders(getEnv: EnvReader = defaultEnv): ProviderEnvIssue[] {
  return PROVIDER_VARS.flatMap((p) => {
    const raw = (getEnv(p.env) ?? "").toLowerCase().trim()
    if (raw === "" || raw === "mock") {
      return [{ env: p.env, label: p.label, value: raw === "" ? "(ayarsız)" : raw }]
    }
    return []
  })
}

/** Multi-line banner text for the given issues (no I/O — pure, so it's testable). */
export function buildProviderWarningBanner(issues: ProviderEnvIssue[]): string {
  return [
    "",
    "  ┌────────────────────────────────────────────────────────────────┐",
    "  │  ⚠  SAĞLAYICI UYARISI — GERÇEK YERİNE DEMO/MOCK VERİ DÖNÜYOR      │",
    "  └────────────────────────────────────────────────────────────────┘",
    ...issues.map((i) => `  • ${i.env}=${i.value} → ${i.label} MOCK sağlayıcı kullanıyor.`),
    "  Düzeltme: bu ortamın .env dosyasına ekleyip container'ı yeniden başlatın:",
    ...issues.map((i) => `      ${i.env}=rapidapi`),
    "      RAPIDAPI_KEY=<rapidapi anahtarınız>",
    "",
  ].join("\n")
}

export interface StartupCheckDeps {
  getEnv?: EnvReader
  /** True only in a production build (staging + prod). Dev is intentionally exempt. */
  isProd?: boolean
  warn?: (msg: string) => void
  info?: (msg: string) => void
}

/**
 * Emit a loud banner at startup when a provider silently uses mock/demo data in
 * a production build. Warn-only by design — these vars are legitimately optional
 * in dev, and a missing feature var must not take the whole app down.
 */
export function checkProviderEnvAtStartup(deps: StartupCheckDeps = {}): void {
  const {
    getEnv = defaultEnv,
    isProd = process.env.NODE_ENV === "production",
    warn = (m) => console.error(m),
    info = (m) => console.log(m),
  } = deps

  if (!isProd) return

  const issues = findMockProviders(getEnv)
  if (issues.length === 0) {
    const summary = PROVIDER_VARS.map((p) => `${p.env.replace("_PROVIDER", "").toLowerCase()}=${(getEnv(p.env) ?? "").toLowerCase().trim()}`).join(", ")
    info(`[startup] Sağlayıcılar gerçek moda ayarlı (${summary}).`)
    return
  }
  warn(buildProviderWarningBanner(issues))
}
