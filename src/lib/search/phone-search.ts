/**
 * Telefon araması için sorgu terimi.
 *
 * Telefonlar DB'de normalize edilmiş halde saklanır (bkz. `normalizePhone`):
 * ayraçsız, ulusal "0" ve "+90" ülke kodu olmadan, 10 hane — `"5445157408"`.
 * Kullanıcı ise ekranda gördüğü biçimi (`"0544 515 74 08"`) ya da bir parçasını
 * (`"0544"`, `"544 515"`) yazar; ham `contains` bu yazımların hiçbirini
 * eşleştiremez — aramanın "çalışmıyor" görünmesinin nedeni budur (#178).
 *
 * Bu yüzden sorgudan yalnızca rakamları alır, baştaki sıfırları ve ülke kodunu
 * atarız; sonuç saklanan değerin bir alt-dizesi olur ve `contains` ile eşleşir.
 *
 * `normalizePhone`'dan farkı: bu fonksiyon **kısmi** girişte de çalışır (o,
 * 10 haneden kısa girdide baştaki "0"ı korur çünkü kayıt için kanonik değer
 * üretir) ve doğrulama değil arama içindir. Rakam içermeyen sorguda `""` döner —
 * çağıran taraf `contains: ""` (her kaydı eşleyen) kuralı eklememelidir.
 */
export function phoneSearchTerm(input: string): string {
  let digits = input.replace(/\D/g, "").replace(/^0+/, "")
  if (digits.startsWith("90") && digits.length > 10) digits = digits.slice(2)
  return digits
}
