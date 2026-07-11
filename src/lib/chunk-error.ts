/**
 * Deploy sonrası "bayat chunk" kurtarması.
 *
 * Yeni build her seferinde yeni (rastgele build-id'li) `/_next/static/...`
 * chunk dosyaları üretir. Tarayıcıda cache'li eski HTML veya açık bir sekme,
 * artık var olmayan eski chunk'ı ister → 404 → ChunkLoadError → beyaz ekran.
 * Kullanıcının cache temizlemesine gerek kalmadan sayfayı bir kez yenileyerek
 * taze HTML + güncel chunk'lara geçeriz.
 */

/** ChunkLoadError ve dinamik-import yükleme hatalarını tanır. */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false
  const err = error as { name?: string; message?: string }
  const name = err.name || ""
  const message = err.message || ""
  return (
    name === "ChunkLoadError" ||
    /Loading chunk [^\s]+ failed/i.test(message) ||
    /Loading CSS chunk/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /importing a module script failed/i.test(message)
  )
}

const RELOAD_KEY = "bakimx:chunk-reloaded-at"
// Aynı deploy penceresinde sonsuz reload döngüsünü önlemek için kısa aralık.
const RELOAD_COOLDOWN_MS = 10_000

/**
 * Chunk hatasında sayfayı en fazla cooldown başına bir kez yeniler.
 * Yenileme tetiklendiyse `true` döner (çağıran UI göstermeden çıkabilir).
 * Yakın zamanda zaten yenilendiyse `false` döner → gerçek hata UI'si gösterilir.
 */
export function reloadOnceForChunkError(): boolean {
  if (typeof window === "undefined") return false
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) || "0")
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    // sessionStorage erişilemezse (private mode vb.) yine de bir kez dene.
  }
  window.location.reload()
  return true
}
