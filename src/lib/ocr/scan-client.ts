/** OCR sunucuda birkaç saniye sürebilir; istek süresiz asılı kalmasın. */
export const SCAN_TIMEOUT_MS = 45_000

export type ScanImagePayload = { dataUrl: string; mimeType: string }

/** Kullanıcıya gösterilmeye hazır (Türkçe) mesaj taşıyan hata. */
export class ScanError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ScanError"
  }
}

/**
 * Tarayıcıdan yakalanan kareyi bir OCR uç noktasına gönderir ve JSON gövdesini döner.
 * Başarısızlıkta kullanıcıya gösterilebilir Türkçe mesajla `Error` fırlatır —
 * çağıran taraf yalnız başarı yolunu yazar.
 */
export async function postImageScan<T>(endpoint: string, payload: ScanImagePayload): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS)
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageDataUrl: payload.dataUrl, mimeType: payload.mimeType }),
      signal: controller.signal,
    })
    // Yanıt JSON olmayabilir (örn. proxy 502/504 HTML'i); güvenli çözümle.
    const raw = await res.text()
    let data: (T & { error?: string }) | null = null
    try {
      data = raw ? (JSON.parse(raw) as T & { error?: string }) : null
    } catch {
      data = null
    }
    if (!res.ok) {
      throw new ScanError(data?.error || "Sunucu beklenmedik bir yanıt döndü. Lütfen tekrar deneyin.")
    }
    if (!data) throw new ScanError("Sunucu beklenmedik bir yanıt döndü. Lütfen tekrar deneyin.")
    return data
  } catch (err) {
    if (err instanceof ScanError) throw err
    // AbortError dışındaki her şey (ağ kopması, DNS, CORS…) kullanıcı için aynı:
    // İngilizce tarayıcı mesajını sızdırmadan tek bir Türkçe mesaja indir.
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ScanError("Okuma zaman aşımına uğradı. Lütfen tekrar deneyin.")
    }
    throw new ScanError("Bağlantı hatası. Lütfen tekrar deneyin.")
  } finally {
    clearTimeout(timeout)
  }
}
