/**
 * `ui/select.tsx` sınırında Radix'ten gelen değeri çağrı yerinin sözleşmesine
 * çevirir; `null` dönerse değişiklik YUTULUR (#907).
 *
 * Radix Select bir <form> içinde gizli yerel <select> basar. Yeni bir seçenek
 * ve değeri aynı render'da verilirse yerel <option> bir render geç kaydolur;
 * gizli select değeri yazıp "change" yayınca `onValueChange("")` gelir ve dolu
 * alan boşalır (#884). Gerçek bir "seçim yok" seçimi `SelectItem`'dan nöbetçi
 * değerle (`emptySentinel`) gelir, yani ham `""` her zaman sahte yayımdır —
 * kontrollü değer doluyken yutulur. Kontrolsüz kullanımda (`current`
 * `undefined`) bir şey yutulmaz.
 */
export function resolveSelectValueChange(
  raw: string,
  current: string | undefined,
  emptySentinel: string
): string | null {
  if (raw === emptySentinel) return ""
  if (raw === "" && current !== undefined && current !== "") return null
  return raw
}
