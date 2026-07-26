/**
 * Türkçe noktalı/noktasız I'ya dayanıklı, büyük-küçük harf duyarsız "contains".
 * "ais" → "AISIN" eşleşmeli: tr-lower "AISIN" = "aısın" (noktasız ı) dotted "ais"
 * ile eşleşmez; bu yüzden tr-locale VE nötr (Latin) lowercase'in OR'u alınır.
 * "İ"/"ı" da doğru katlanır. Boş sorgu her şeyle eşleşir.
 */
export function trIncludes(haystack: string, needle: string): boolean {
  const n = needle.trim()
  if (!n) return true
  return (
    haystack.toLocaleLowerCase("tr").includes(n.toLocaleLowerCase("tr")) ||
    haystack.toLowerCase().includes(n.toLowerCase())
  )
}

/**
 * Aksan katlama tablosu: Türkçe + yaygın Latin aksanlı harfler → ASCII karşılığı.
 * Küçük harfler yeterlidir (katlama her zaman lowercase SONRASI uygulanır).
 *
 * Postgres `translate(string, from, to)` 1:1 karakter eşlemesi ister → iki dize
 * AYNI uzunlukta ve kaynak harfler tekrarsız olmalı (bkz. tr-search.test.ts).
 * SQL tarafı bu sabitleri bind parametresi olarak kullanır (searchVehicleArticles),
 * böylece iki uçtaki tablo tanım gereği aynı kalır.
 */
export const FOLD_FROM = "çğıöşüâîûêôáéíóúàèìòùäëïÿñ"
export const FOLD_TO = "cgiosuaiueoaeiouaeiouaeiyn"

/**
 * Ayraç-duyarsız arama anahtarı: küçük harfe indirir, Türkçe/aksanlı harfleri
 * ASCII karşılığına çevirir, harf/rakam dışındaki her şeyi (boşluk, tire, nokta,
 * eğik çizgi, parantez vb.) siler. Böylece "C 27 125", "C-27-125", "c27125" aynı
 * "c27125" anahtarına; "Silecek süpürgesi" ile ASCII klavyeden yazılan "silecek
 * supurge" aynı "sileceksupurge…" anahtarına iner.
 *
 * Katlama şart: aksi halde [^a-z0-9] süzgeci ü/ö/ş'yi SİLİYOR ("süpürge"→"sprge")
 * ve ASCII yazan kullanıcı Türkçe adlı hiçbir parçayı bulamıyordu.
 *
 * "İ" (U+0130) lowercase'te i + birleşen nokta (U+0307) üretir; birleşen işaret
 * [^a-z0-9] tarafından atıldığı için sonuç yine "i" olur — hem JS hem SQL'de.
 *
 * DB karşılığı `regexp_replace(translate(lower(col), FOLD_FROM, FOLD_TO),
 * '[^a-z0-9]', '', 'g')` ile simetriktir (bkz. searchVehicleArticles).
 */
export function normalizePartSearchTerm(input: string): string {
  let out = ""
  for (const ch of input.toLowerCase()) {
    const i = FOLD_FROM.indexOf(ch)
    out += i === -1 ? ch : FOLD_TO[i]
  }
  return out.replace(/[^a-z0-9]/g, "")
}

/**
 * Ayraç-duyarsız "contains": haystack ve needle'ı normalizePartSearchTerm ile
 * indirip alt-dize kontrolü yapar. Parça no/ad araması için trIncludes'ın
 * ayraç-duyarsız muadili. Boş needle her şeyle eşleşir.
 */
export function partSearchIncludes(haystack: string, needle: string): boolean {
  const n = normalizePartSearchTerm(needle)
  if (!n) return true
  return normalizePartSearchTerm(haystack).includes(n)
}
