/**
 * Yerel QA oturum kısayolunun (`/api/auth/dev-login`) saf kuralları.
 *
 * Route'un kendisi Prisma'ya dokunduğu için testte izole edilemez; karar
 * verilen iki şey (kimin çağırabildiği ve nereye yönlendirdiği) burada saf
 * fonksiyonlar olarak durur ve birim testi vardır.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"])

/**
 * Kısayol yalnızca `bun run dev` ile çalışan yerel bir sunucuda açıktır.
 * İki bağımsız kapı: NODE_ENV `development` olmalı VE istek localhost'tan
 * gelmeli. Prod imajında NODE_ENV=production olduğu için route 404'tür;
 * host kontrolü ise NODE_ENV'i yanlışlıkla devralan bir ortamda ikinci
 * savunma hattıdır.
 */
export function isDevLoginAllowed(nodeEnv: string | undefined, host: string | null): boolean {
  if (nodeEnv !== "development") return false
  const hostname = (host || "").split(":")[0].toLowerCase()
  return LOCAL_HOSTS.has(hostname) || hostname.endsWith(".local")
}

/**
 * Yönlendirme hedefi: yalnızca aynı origin'deki mutlak yollar. `//evil.com`,
 * `https://…` ve şema içeren her şey reddedilir (open redirect).
 */
export function safeRedirectPath(raw: string | null, fallback = "/dashboard"): string {
  if (!raw) return fallback
  if (!raw.startsWith("/")) return fallback
  if (raw.startsWith("//")) return fallback
  if (raw.includes("\\")) return fallback
  return raw
}
