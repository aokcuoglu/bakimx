/**
 * Boot-time sanity check for the paid-provider env vars. Each of these silently
 * falls back to a mock/demo dataset when unset (see getVinProvider /
 * getTecdocProvider), so a missing var on the VPS makes real queries return
 * demo data with no error — exactly the "VIN katalogda bulunamadı" trap that bit
 * staging when .env.staging lacked VIN_PROVIDER. This surfaces the mismatch at
 * startup instead of on the first user query buried in the logs.
 */

/**
 * Provider vars that resolve to a mock/demo provider when unset or "mock".
 * `realValue`/`keyEnv` feed the fix hint — they differ per provider, so a single
 * hardcoded "=rapidapi + RAPIDAPI_KEY" line would be wrong for OCR/AI.
 */
const PROVIDER_VARS = [
  { env: "VIN_PROVIDER", label: "VIN'den araç tanıma", realValue: "rapidapi", keyEnv: "RAPIDAPI_KEY" },
  { env: "TECDOC_PROVIDER", label: "TecDoc parça kataloğu", realValue: "rapidapi", keyEnv: "RAPIDAPI_KEY" },
  { env: "OCR_PROVIDER", label: "Ruhsat okuma (OCR)", realValue: "anthropic", keyEnv: "ANTHROPIC_API_KEY" },
  { env: "AI_PROVIDER", label: "Servis danışmanı (AI)", realValue: "anthropic", keyEnv: "ANTHROPIC_API_KEY" },
  { env: "MARKET_RESEARCH_PROVIDER", label: "Piyasa araştırması", realValue: "anthropic", keyEnv: "ANTHROPIC_API_KEY" },
] as const

export interface ProviderEnvIssue {
  env: string
  label: string
  /** The raw (lowercased) value, or "(ayarsız)" when absent/empty. */
  value: string
  /** The value that switches this provider to the real service. */
  realValue: string
  /** The credential var that real mode additionally needs. */
  keyEnv: string
}

export type EnvReader = (name: string) => string | undefined

const defaultEnv: EnvReader = (name) => process.env[name]

/** Pure: the provider vars that currently resolve to the mock provider. */
export function findMockProviders(getEnv: EnvReader = defaultEnv): ProviderEnvIssue[] {
  return PROVIDER_VARS.flatMap((p) => {
    const raw = (getEnv(p.env) ?? "").toLowerCase().trim()
    if (raw === "" || raw === "mock") {
      return [
        {
          env: p.env,
          label: p.label,
          value: raw === "" ? "(ayarsız)" : raw,
          realValue: p.realValue,
          keyEnv: p.keyEnv,
        },
      ]
    }
    return []
  })
}

/** Multi-line banner text for the given issues (no I/O — pure, so it's testable). */
export function buildProviderWarningBanner(issues: ProviderEnvIssue[]): string {
  // Aynı anahtar birden çok sağlayıcıyı besliyor (RAPIDAPI_KEY → vin + tecdoc),
  // ipucunda tekrar etmesin.
  const keyEnvs = [...new Set(issues.map((i) => i.keyEnv))]
  return [
    "",
    "  ┌────────────────────────────────────────────────────────────────┐",
    "  │  ⚠  SAĞLAYICI UYARISI — GERÇEK YERİNE DEMO/MOCK VERİ DÖNÜYOR      │",
    "  └────────────────────────────────────────────────────────────────┘",
    ...issues.map((i) => `  • ${i.env}=${i.value} → ${i.label} MOCK sağlayıcı kullanıyor.`),
    "  Düzeltme: bu ortamın sağlayıcı ayarlarına ekleyip servisi yeniden başlatın",
    "  (AWS: SSM Parameter Store /bakimx/<env>/<DEĞİŞKEN> — yerelde .env.local):",
    ...issues.map((i) => `      ${i.env}=${i.realValue}`),
    ...keyEnvs.map((k) => `      ${k}=<anahtarınız>`),
    "",
  ].join("\n")
}

export interface StartupCheckDeps {
  getEnv?: EnvReader
  /** True only in a production build (app-dev + prod). Dev is intentionally exempt. */
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
