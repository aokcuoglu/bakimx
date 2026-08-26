/**
 * Atölyelerin kayıt sırasında paylaşabildiği referans kodu sözleşmesi.
 *
 * Kodlar telefonda veya mesajla aktarılacağı için yalnız ASCII büyük harf,
 * rakam ve tire ayıracı kullanır. Normalizasyon karşılaştırmayı büyük/küçük harften
 * bağımsız yapar; biçimi sessizce değiştirmez, böylece yazım hatası başka bir
 * geçerli koda dönüşmez.
 */

export const REFERRAL_CODE_MIN_LENGTH = 4
export const REFERRAL_CODE_MAX_LENGTH = 24

const REFERRAL_CODE_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/

export function normalizeReferralCode(value: string): string {
  return value.trim().toUpperCase()
}

export function isValidReferralCode(value: string): boolean {
  const code = normalizeReferralCode(value)
  return (
    code.length >= REFERRAL_CODE_MIN_LENGTH &&
    code.length <= REFERRAL_CODE_MAX_LENGTH &&
    REFERRAL_CODE_PATTERN.test(code)
  )
}
