import { readFileSync } from "node:fs"
import { join } from "node:path"
import { APP_VERSION } from "./app-version"

/**
 * Bu sunucu sürecinin çalıştırdığı build'i tanımlayan imza (sunucu tarafı).
 *
 * Neden yalnızca `NEXT_PUBLIC_APP_VERSION` yetmiyor: deploy `main`/`dev` push'u ile
 * tetikleniyor, sürüm ise yalnızca `bun run release` çalıştığında artıyor. Sürüm
 * artmayan bir deploy da yeni (farklı hash'li) `/_next/static/...` chunk'ları üretir,
 * yani asıl uyuşmazlık sinyali Next'in build id'sidir.
 *
 * Build id `.next/BUILD_ID` dosyasından okunur; standalone çıktısında da bulunur.
 * Dosya okunamazsa imza sürüme düşer: bildirim yalnızca sürüm artışında çalışır,
 * hiçbir şey bozulmaz.
 *
 * Üretim dışında build id HİÇ okunmaz (#776). `next dev` bu dosyayı yazmaz, ama aynı
 * klasörde `bun run build` alınırsa dosya oluşur ve her build'de değişir. İmza modül
 * başına önbelleğe alındığı için layout ile `/api/version` farklı anlarda farklı id
 * tutuyor, "Yeni sürüm kullanılabilir" bildirimi geri gelip duruyor ve "Şimdi Yenile"
 * onu geçirmiyordu (iki önbellek de aynı sunucu sürecinde yaşıyor).
 */
let cached: string | null = null

export function getBuildSignature(): string {
  if (cached) return cached
  cached = computeBuildSignature(process.env.NODE_ENV, readBuildId)
  return cached
}

/** Saf hesap: ortam ve build id okuyucusu dışarıdan verilir (test edilebilir). */
export function computeBuildSignature(
  nodeEnv: string | undefined,
  readId: () => string,
): string {
  if (nodeEnv !== "production") return `${APP_VERSION}+development`
  return `${APP_VERSION}+${readId()}`
}

function readBuildId(): string {
  try {
    const id = readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim()
    return id || "unknown"
  } catch {
    return "unknown"
  }
}
