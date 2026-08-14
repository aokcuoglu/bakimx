/**
 * Kullanıcı kimliği — e-posta VEYA tenant içi kullanıcı adı (BAK-40).
 *
 * `User.email` artık nullable: e-postası olmayan usta/çırak `(workshopId, username)`
 * ile giriş yapar. Bu modül o ikiliyi tarif eden saf kuralları taşır; prisma
 * bağımlılığı yoktur, hem sunucu kapıları hem testler aynı fonksiyonları okur.
 *
 * Buradaki iki kural migration'da DB CHECK kısıtı olarak da duruyor
 * (`User_identity_present`, `User_privileged_role_requires_email`). İkizleri
 * bilerek: DB sessiz bozulmayı imkânsız kılar, buradaki kopya kullanıcıya
 * anlaşılır bir hata verir.
 */

import type { UserRole } from "@prisma/client"
import { roleRequiresEmail } from "@/lib/roles"
import { FOLD_FROM, FOLD_TO } from "@/lib/tr-search"

export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 32

/**
 * Küçük harf, rakam, nokta/alt tire/tire — baş ve sonda yalnız harf/rakam.
 * `@` KASITLI olarak yasak: giriş alanı "e-posta mı kullanıcı adı mı" ayrımını
 * `@` üzerinden yapıyor, bir kullanıcı adı o ayrımı bulanıklaştıramamalı.
 */
const USERNAME_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/

/** Kullanıcı adını tek biçime indirir — saklama ve arama aynı değeri kullanır. */
export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase()
}

export function isValidUsername(value: string): boolean {
  const username = normalizeUsername(value)
  if (username.length < USERNAME_MIN_LENGTH || username.length > USERNAME_MAX_LENGTH) return false
  return USERNAME_PATTERN.test(username)
}

/**
 * Ad/soyad parçasını kullanıcı adında kullanılabilir ASCII'ye indirir.
 * Türkçe küçültme ÖNCE gelir ("I" → "ı" → "i"), aksanlar `tr-search` tablosuyla
 * katlanır, kalan her şey atılır.
 */
function foldNameSegment(value: string): string {
  let out = ""
  for (const ch of value.toLocaleLowerCase("tr").normalize("NFD")) {
    const index = FOLD_FROM.indexOf(ch)
    if (index >= 0) {
      out += FOLD_TO[index]
      continue
    }
    if (ch >= "a" && ch <= "z") out += ch
    else if (ch >= "0" && ch <= "9") out += ch
  }
  return out
}

/**
 * Ad-soyaddan kullanıcı adı önerisi: "Mehmet Yılmaz" → "mehmet.yilmaz" (BAK-37).
 *
 * Sahip formu doldururken kullanıcı adını sıfırdan uydurmak zorunda kalmasın;
 * öneri her zaman düzenlenebilir ve benzersizliğe DB karar verir. Öneri geçerli
 * bir kullanıcı adına inmiyorsa boş döner — hatalı bir değeri forma yazmaktansa
 * alanı boş bırakmak dürüst davranıştır.
 */
export function suggestUsername(
  firstName?: string | null,
  lastName?: string | null
): string {
  const parts = [firstName ?? "", lastName ?? ""].map(foldNameSegment).filter(Boolean)
  if (parts.length === 0) return ""
  const candidate = parts.join(".").slice(0, USERNAME_MAX_LENGTH).replace(/[._-]+$/, "")
  return isValidUsername(candidate) ? candidate : ""
}

/**
 * Girdi e-posta yolu mu, kullanıcı adı yolu mu? Tek ayraç `@`.
 * (Geçerli bir e-posta olup olmadığına zod karar verir — bu yalnız yol seçimi.)
 */
export function isEmailIdentifier(value: string): boolean {
  return value.includes("@")
}

/**
 * DB'deki `User_identity_present` CHECK'inin uygulama ikizi: girişsiz kullanıcı
 * yaratılamaz.
 */
export function hasLoginIdentity(user: { email?: string | null; username?: string | null }): boolean {
  return Boolean(user.email) || Boolean(user.username)
}

/**
 * Rol/e-posta uyumu. Rol yükseltme yolunu da kapsar: e-postasız bir `usta`
 * `manager`'a terfi ettirilemez.
 */
export function roleAllowedForUser(
  role: UserRole,
  user: { email?: string | null }
): boolean {
  return !roleRequiresEmail(role) || Boolean(user.email)
}

/**
 * Şifre sıfırlama e-postası gönderilebilir mi? E-postasız kullanıcı bu akışta
 * HİÇ eşleşmemeli — onun şifresini atölye sahibi ekip panelinden sıfırlar (P1).
 * Devre dışı bırakılmış hesap da token almaz.
 */
export function canReceivePasswordReset(
  user: { email?: string | null; isActive: boolean } | null | undefined
): boolean {
  return Boolean(user?.isActive && user.email)
}
