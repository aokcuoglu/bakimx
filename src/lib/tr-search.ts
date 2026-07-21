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
 * Ayraç-duyarsız arama anahtarı: harf/rakam dışındaki her şeyi (boşluk, tire,
 * nokta, eğik çizgi, parantez vb.) siler ve küçük harfe indirir. Böylece
 * "C 27 125", "C-27-125", "c27125" hepsi aynı "c27125" anahtarına iner —
 * parça numarasını kullanıcının nasıl yazdığından bağımsız bulmak için.
 *
 * DB tarafındaki karşılığı `regexp_replace(lower(col), '[^a-z0-9]', '', 'g')`
 * ile simetriktir: ikisi de Latin harf/rakam dışını (Türkçe harfler dahil)
 * attığı için client ve server aynı sonucu üretir (bkz. searchVehicleArticles).
 */
export function normalizePartSearchTerm(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "")
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
