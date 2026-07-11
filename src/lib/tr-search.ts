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
