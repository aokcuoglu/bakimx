/**
 * İstemci tarafı kart girişi yardımcıları — CardPaymentPanel için hafif doğrulama
 * ve görsel formatlama. Bilinçli olarak bağımsız (payment-helpers'ın `crypto`
 * bağımlılığını client bundle'a taşımamak için); server tarafı asıl doğrulamayı
 * yine kendi zod+Luhn şemasıyla yapar (bkz. api/payments/tami/initiate).
 *
 * KART VERİSİ burada YALNIZ formatlama/doğrulama için işlenir; hiçbir fonksiyon
 * loglamaz, saklamaz veya ağa göndermez.
 */

/** Rakam dışındaki her karakteri atar. */
export function stripNonDigits(value: string): string {
  return value.replace(/\D/g, "")
}

/**
 * Luhn (mod-10) kontrolü + 12–19 hane uzunluk sınırı. Boşluk/tire içeren girdi
 * de kabul edilir (önce temizlenir). Geçersiz uzunluk/boş → false.
 */
export function luhnValid(cardNumber: string): boolean {
  const digits = stripNonDigits(cardNumber)
  if (digits.length < 12 || digits.length > 19) return false
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    double = !double
  }
  return sum % 10 === 0
}

/**
 * Görünen kart numarasını 4'lü gruplar hâlinde biçimlendirir (yalnız rakam,
 * en fazla 19 hane). Submit edilen değer AYRICA rakam-temizlenir; bu yalnız
 * ekran içindir.
 */
export function formatCardNumber(value: string): string {
  const digits = stripNonDigits(value).slice(0, 19)
  return digits.replace(/(.{4})/g, "$1 ").trim()
}

/**
 * Son kullanma tarihi geçmiş mi? Ay 1–12 dışıysa veya tarih içinde bulunulan
 * aydan önceyse `true` (submit engellenir). 2 haneli yıl 4 haneye normalize
 * edilir ("26" → 2026). `now` test için enjekte edilebilir.
 */
export function isExpiryPast(month: number, year: number, now: Date = new Date()): boolean {
  if (!Number.isInteger(month) || month < 1 || month > 12) return true
  const fullYear = year < 100 ? year + 2000 : year
  const curYear = now.getFullYear()
  const curMonth = now.getMonth() + 1
  if (fullYear < curYear) return true
  if (fullYear > curYear) return false
  return month < curMonth
}
