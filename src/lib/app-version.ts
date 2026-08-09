/**
 * Deploy sonrası sürüm uyuşmazlığı — hatadan ÖNCE haber verme katmanı.
 *
 * `chunk-error.ts` bayat chunk'ı ancak hata OLUŞTUKTAN sonra tek seferlik reload
 * ile kurtarır; kullanıcı önce beyaz ekranı görür. Burada tersini yapıyoruz:
 * istemcinin yüklendiği build ile sunucunun o an çalıştırdığı build karşılaştırılır,
 * fark varsa engellemeyen bir bildirim gösterilir. Zorla reload YOK — yarım kalmış
 * bir iş emri formu varken veri kaybettirir; yenileme anını kullanıcı seçer.
 *
 * Bu dosya saf (fs/DOM yok) tutulur: hem istemci bileşeni hem sunucu tarafı import eder.
 * Build imzasını üreten sunucu-yanı `build-signature.ts` içindedir.
 */

/** Derleme zamanında `package.json`'dan gömülür (bkz. next.config.ts `env`). */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0"

/** `/api/version` yanıtının şekli. */
export type VersionPayload = {
  version: string
  signature: string
}

/** Bilinmeyen bir JSON gövdesini güvenle `VersionPayload`'a daraltır. */
export function parseVersionPayload(data: unknown): VersionPayload | null {
  if (!data || typeof data !== "object") return null
  const { version, signature } = data as Record<string, unknown>
  if (typeof version !== "string" || typeof signature !== "string") return null
  if (!version || !signature) return null
  return { version, signature }
}

/**
 * Sunucu yanıtına göre "istemcinin yüklediği build eskidi mi" kararı.
 *
 * Bilinmeyen/bozuk yanıtlarda ve imza okunamadığında `false` döner — yanlış
 * pozitif bir "yeni sürüm var" bildirimi, sessizce hiç bildirim göstermemekten
 * daha kötüdür (kullanıcı boşuna yeniler, form verisi riske girer).
 */
export function isOutdatedBuild(loadedSignature: string, data: unknown): boolean {
  if (!loadedSignature) return false
  const payload = parseVersionPayload(data)
  if (!payload) return false
  return payload.signature !== loadedSignature
}
