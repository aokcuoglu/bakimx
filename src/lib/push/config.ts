/**
 * Web Push (VAPID) yapılandırması — BAK-129, Faz B.
 *
 * Anahtarlar SSM Parameter Store'dan RUNTIME env olarak gelir
 * (`/bakimx/<env>/VAPID_PUBLIC_KEY`, `.../VAPID_PRIVATE_KEY`), bu yüzden
 * `NEXT_PUBLIC_*` DEĞİLLER: build sırasında gömülen bir değişken SSM'deki
 * değeri asla göremez. Açık anahtar istemciye `/api/technician/push` ucundan
 * çalışma zamanında verilir.
 *
 * Yapılandırma yoksa push sessizce devre dışıdır — lokal geliştirmede ve
 * anahtar konmamış bir ortamda hiçbir şey kırılmaz, yalnız Faz A'daki
 * uygulama-içi bildirim çalışmaya devam eder.
 */
export type VapidConfig = {
  subject: string
  publicKey: string
  privateKey: string
}

function read(name: string): string {
  return (process.env[name] ?? "").trim()
}

export function getVapidConfig(): VapidConfig | null {
  const publicKey = read("VAPID_PUBLIC_KEY")
  const privateKey = read("VAPID_PRIVATE_KEY")
  if (!publicKey || !privateKey) return null

  // RFC 8292: `sub` bir mailto: veya https: URI olmalı. Push servisleri geçersiz
  // bir değerde 400 döner, bu yüzden override edilmemişse sabit destek adresi.
  const subject = read("VAPID_SUBJECT") || "mailto:destek@bakimx.com"
  return { subject, publicKey, privateKey }
}

export function isWebPushConfigured(): boolean {
  return getVapidConfig() !== null
}
