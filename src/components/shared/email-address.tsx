/**
 * Public sayfalarda e-posta adresi basmanın TEK yolu (#735).
 *
 * bakimx.com Cloudflare arkasında ve Cloudflare'in "Email Address Obfuscation"
 * özelliği sunucu HTML'indeki her adresi yolda `[email protected]` bağlantısına
 * çeviriyor (`mailto:` href'leri de `/cdn-cgi/l/email-protection#…` oluyor).
 * React hydration sırasında bulduğu DOM'u kendi ürettiğiyle karşılaştırdığı için
 * bu, adresin geçtiği her sayfada React #418 (hydration uyuşmazlığı) üretiyordu.
 * Yerelde Cloudflare olmadığı için hiç görünmüyordu.
 *
 * Çözüm Cloudflare'in belgelediği kaçış: `<!--email_off-->…<!--/email_off-->`
 * arasındaki içerik gizlenmez. React yorum düğümü basamadığı için içerik
 * `dangerouslySetInnerHTML` ile verilir — React bu içeriği hydration'da
 * karşılaştırmaz, yani Cloudflare yorumları silse bile uyuşmazlık doğmaz.
 * Cloudflare ayarı kapatılsa da bileşen doğru çalışır.
 *
 * Girdi yalnız sabit şirket adresleridir; yine de HTML'e kaçışlanarak yazılır.
 * Kaynak tarayan `email-address.test.ts`, public yüzeyde bu bileşeni atlayan
 * ham adres ya da `mailto:` kullanımını reddeder.
 */

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char])
}

export function emailAddressHtml(address: string, link: boolean): string {
  const safe = escapeHtml(address)
  const inner = link ? `<a href="mailto:${safe}">${safe}</a>` : safe
  return `<!--email_off-->${inner}<!--/email_off-->`
}

type EmailAddressProps = {
  address: string
  /** `true` (varsayılan) ise `mailto:` bağlantısı, değilse düz metin. */
  link?: boolean
  className?: string
}

export function EmailAddress({ address, link = true, className }: EmailAddressProps) {
  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: emailAddressHtml(address, link) }}
    />
  )
}
