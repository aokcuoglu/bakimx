import type { PoolConfig } from "pg"

/**
 * Build the `pg` Pool config for a Postgres URL, applying the AWS RDS TLS workaround
 * and the liveness bounds that keep a dead socket from hanging a request forever.
 *
 * AWS RDS presents an Amazon RDS CA that Node does not trust out of the box, and the pg
 * driver's newer default verifies the chain (`sslmode=require` now behaves like
 * `verify-full`), failing with "self-signed certificate in certificate chain". With
 * `DB_SSL_NO_VERIFY=true` the connection is still encrypted but the chain is not verified
 * (acceptable for the private, in-VPC RDS instances). Local dev leaves the flag unset and
 * puts `sslmode=no-verify` in the URL instead → the string is used unchanged.
 *
 * Kept dependency-free (type-only import) so scripts baked into the Docker `/migrate`
 * tree can reuse it without pulling in the Prisma client. Consumers: src/lib/db.ts,
 * prisma/seed.ts, scripts/migrate-vehicle-catalog.ts, scripts/prod-reset.ts.
 */

/**
 * Bağlantı alma (kuyruk + TCP + handshake) üst sınırı. `pg` varsayılanı 0'dır —
 * yani sonsuz bekle. Yerel dev, AWS dev veritabanına SSM port-forward üzerinden
 * bağlanır; o oturum öldüğünde localhost:5433 DİNLEMEYE DEVAM EDER
 * (session-manager-plugin soketi tutar) ama tek bayt akmaz. Sınır olmayınca her
 * sorgu sonsuza kadar asılır: /api/auth/login hiç cevap dönmez ve giriş ekranı
 * sonsuza kadar "Giriş yapılıyor..." gösterir. Aynı sessiz asılma prod'da bir ağ
 * kesintisinde de geçerlidir.
 */
export const DEFAULT_CONNECT_TIMEOUT_MS = 10_000

/**
 * Tek bir sorgunun üst sınırı. Yalnızca uygulama havuzuna uygulanır
 * (`buildAppPoolConfig`): bir web isteği içinde bu kadar süren sorgu zaten
 * başarısızdır. Bakım script'leri (seed, katalog migrasyonu, prod-reset) taban
 * `buildPoolConfig`'i kullanır ve sınırsız kalır.
 */
export const DEFAULT_QUERY_TIMEOUT_MS = 30_000

/** Pozitif tam sayı olmayan override sessizce yok sayılır (yanlış env prod'u kilitlemesin). */
function timeoutFromEnv(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function buildPoolConfig(url: string): PoolConfig {
  const base: PoolConfig = {
    connectionTimeoutMillis: timeoutFromEnv("DB_CONNECT_TIMEOUT_MS", DEFAULT_CONNECT_TIMEOUT_MS),
    // Yarı açık soketleri (ölü tünel, NAT zaman aşımı) fark edip kapatır.
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  }

  if (process.env.DB_SSL_NO_VERIFY !== "true") return { ...base, connectionString: url }

  const connectionString = url
    .replace(/([?&])sslmode=[^&]*/gi, "$1")
    .replace(/\?&/g, "?")
    .replace(/[?&]$/g, "")

  return { ...base, connectionString, ssl: { rejectUnauthorized: false } }
}

/**
 * Uygulama havuzu: taban yapılandırma + istek ömrüne uygun sorgu sınırları.
 * `query_timeout` istemci tarafında iptal eder, `statement_timeout` sunucuya da
 * söyler ki sorgu Postgres'te boşuna çalışmaya devam etmesin.
 */
export function buildAppPoolConfig(url: string): PoolConfig {
  const queryTimeout = timeoutFromEnv("DB_QUERY_TIMEOUT_MS", DEFAULT_QUERY_TIMEOUT_MS)
  return {
    ...buildPoolConfig(url),
    query_timeout: queryTimeout,
    statement_timeout: queryTimeout,
  }
}
