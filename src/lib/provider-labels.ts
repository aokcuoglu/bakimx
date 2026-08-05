/**
 * Ayar ekranlarında gösterilen sağlayıcı adları.
 *
 * `mock`, sağlayıcı seçilmediğinde devreye giren geliştirme sağlayıcısıdır:
 * mesaj gerçekten gönderilmez, yalnızca iletişim kayıtlarına yazılır. Atölye
 * kullanıcısı için "Mock (Test)" hiçbir şey ifade etmiyordu (#195), bu yüzden
 * arayüzde teknik ad yerine ne olduğunu söyleyen bir etiket gösteriyoruz.
 *
 * Kayıtlı/gönderilen değer `mock` olarak kalır — burada değişen yalnızca
 * kullanıcıya görünen metin.
 */

/** SMS / WhatsApp / e-posta: mesaj gerçekten gönderilmez. */
export const SENDING_DISABLED_LABEL = "Kapalı (gönderim yapılmaz)"

/** Takvim: harici senkronizasyon yok, etkinlikler uygulama içinde kalır. */
export const CALENDAR_DISABLED_LABEL = "Kapalı (Google Takvim bağlı değil)"

export const SMS_PROVIDER_LABELS: Record<string, string> = {
  mock: SENDING_DISABLED_LABEL,
  netgsm: "Netgsm",
}

export const WHATSAPP_PROVIDER_LABELS: Record<string, string> = {
  mock: SENDING_DISABLED_LABEL,
  business_api: "WhatsApp Business API",
}

export const EMAIL_PROVIDER_LABELS: Record<string, string> = {
  mock: SENDING_DISABLED_LABEL,
  resend: "Resend",
}

/**
 * Bildirimler ekranı üç kanalın sağlayıcısını tek bir haritadan okur; env'den
 * gelen değerler (`business`, `gmail`) form seçeneklerinden farklı olabiliyor.
 */
export const NOTIFICATION_PROVIDER_LABELS: Record<string, string> = {
  mock: SENDING_DISABLED_LABEL,
  netgsm: "Netgsm",
  business: "WhatsApp Business API",
  business_api: "WhatsApp Business API",
  resend: "Resend",
  gmail: "Gmail",
}
