/**
 * Kabul formundaki "aracı getiren / teslim alacak kişi" alanları (#196 / #149).
 *
 * Üç durumu ayırmak zorundayız ve ikisi kolayca karışıyor:
 *   - alan hiç gönderilmedi (undefined) → mevcut değer KORUNUR
 *   - boş string gönderildi            → TEMİZLENİR ("müşteri kendi getirdi")
 *   - dolu string gönderildi           → yazılır (kırpılmış)
 *
 * Yaygın `sent || current` kalıbı ikinci durumu yutar: kullanıcı alanı bilerek
 * boşaltsa bile eski isim kayıtta kalır ve yanlış kişi kayıtlı görünür.
 */
export function resolveHandoverField(
  sent: string | undefined,
  current: string | null
): string | null {
  if (sent === undefined) return current
  return sent.trim() || null
}
