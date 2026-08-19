/**
 * Kalem satırındaki (parça / işçilik) aksiyonların "satır içi + ⋯ taşma menüsü"
 * düzenine bölünmesi — başlıktaki `splitHeaderActions` ile aynı yaklaşım, satır
 * ölçeğine uyarlanmış hâli (BAK-104).
 *
 * Fark: başlıkta ölçüt "tek birincil CTA", satırda ise **en çok iki ikon**.
 * Satır aksiyonları etiketsiz ikon butonlardır; ikiden fazlası yan yana
 * dizildiğinde dokunma hedefleri birbirine giriyor ve kolon genişliği satırdan
 * satıra değişerek tabloyu tırtıklı gösteriyordu.
 *
 * Taşma durumunda satırda KALAN aksiyon yıkıcı olandır (sil): listede en sık
 * kullanılan odur ve her satırda aynı yerde durması aksiyon kolonunu sabit
 * genişlikte tutar. Yıkıcı aksiyon yoksa (kilitli iş emri) ilk aksiyon kalır.
 */

export const MAX_INLINE_ROW_ACTIONS = 2

export type SplittableRowAction = {
  key: string
  tone: "default" | "danger"
}

export function splitRowActions<T extends SplittableRowAction>(
  actions: readonly T[]
): { inline: T[]; overflow: T[] } {
  if (actions.length <= MAX_INLINE_ROW_ACTIONS) return { inline: [...actions], overflow: [] }

  const pinned = actions.find((a) => a.tone === "danger") ?? actions[0]
  return {
    inline: [pinned],
    overflow: actions.filter((a) => a.key !== pinned.key),
  }
}
