import { randomBytes } from "node:crypto"

/**
 * Sahibin ekip panelinden ürettiği TEK SEFERLİK geçici şifre (BAK-37).
 *
 * E-postası olmayan usta/çırak hesabı, sahibin elinden çıkan bu şifreyle ilk
 * girişini yapar ve `User.mustChangePassword` kapısı onu hemen şifre değiştirme
 * ekranına düşürür. Şifre yalnız üretildiği anda, tek bir sunucu cevabında
 * döner: DB'de yalnızca bcrypt özeti durur, hiçbir log/audit satırına yazılmaz.
 *
 * Tasarım kısıtları — bu şifre WhatsApp'tan paylaşılıyor, kâğıda basılıyor ve
 * yağlı elle telefon klavyesinden giriliyor:
 *  - Alfabede karışan karakter YOK (`I`/`1`, `O`/`0` çıkarıldı) — kâğıda basılan
 *    bir kod okunamıyorsa sahip yeniden sıfırlamak zorunda kalır.
 *  - Tek büyük harf düzlemi: telefon klavyesinde büyük/küçük geçişi hataya davet.
 *  - Ortadaki tire okunurluk içindir ve ŞİFRENİN PARÇASIDIR; ekranda,
 *    WhatsApp metninde ve kartta aynen bu biçimde gösterilir.
 *
 * Uzunluk, `resetPasswordSchema`/hesap şifresi kuralının 8 karakter alt sınırını
 * bilerek aşar (9 karakter) — geçici şifre hiçbir doğrulama kapısına takılmadan
 * kullanıcı şifresi olarak kaydedilebilmeli.
 */

/** 32 karakter: A-H, J-N, P-Z, 2-9. `I`, `O`, `0`, `1` bilerek yok. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

const GROUP_LENGTH = 4
const GROUP_COUNT = 2
const SEPARATOR = "-"

/** Üretilen şifrenin biçimi — testler ve kart/paylaşım metinleri buna dayanır. */
export const TEMP_PASSWORD_PATTERN = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/

/** `XXXX-XXXX` → 9 karakter. */
export const TEMP_PASSWORD_LENGTH = GROUP_COUNT * GROUP_LENGTH + (GROUP_COUNT - 1)

/**
 * Kriptografik rastgelelik. `Math.random()` KULLANILMAZ: bu değer bir hesabın
 * tek anahtarı ve tahmin edilebilir bir üretici, WhatsApp'tan paylaşılan şifreyi
 * paylaşılmadan da bilinir hâle getirir.
 *
 * Alfabe 32 karakter ve 256 % 32 === 0 olduğu için `byte % 32` modulo sapması
 * üretmez — her karakterin olasılığı eşit (toplam 40 bit entropi).
 */
function randomChars(count: number): string {
  const bytes = randomBytes(count)
  let out = ""
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length]
  return out
}

export function generateTempPassword(): string {
  return Array.from({ length: GROUP_COUNT }, () => randomChars(GROUP_LENGTH)).join(SEPARATOR)
}
