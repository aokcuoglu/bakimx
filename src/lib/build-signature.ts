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
 * Build id `.next/BUILD_ID` dosyasından okunur; standalone çıktısında da bulunur ve
 * `next dev`'de sabit ("development") kalır — dev sunucusunda bildirim tetiklenmez.
 * Dosya okunamazsa imza sürüme düşer: bildirim yalnızca sürüm artışında çalışır,
 * hiçbir şey bozulmaz.
 */
let cached: string | null = null

export function getBuildSignature(): string {
  if (cached) return cached
  cached = `${APP_VERSION}+${readBuildId()}`
  return cached
}

function readBuildId(): string {
  try {
    const id = readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim()
    return id || "unknown"
  } catch {
    return "unknown"
  }
}
