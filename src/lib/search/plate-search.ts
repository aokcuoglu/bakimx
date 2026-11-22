import { normalizePlate } from "@/lib/format"

/**
 * Plaka araması için sorgu terimi.
 *
 * Plakalar DB'ye kullanıcının yazdığı gibi kaydedilir: uygulama üzerinden açılan
 * kayıtlarda çoğu zaman ayraçlı (`"34 ABC 123"`), toplu/eski kayıtlarda bitişik
 * (`"34ABC123"`). Arama uç noktası bitişik sorgu için ham `contains` kullanınca
 * ayraçlı kayıt hiç bulunamıyordu — sihirbazın "bu plaka zaten kayıtlı" uyarısı
 * da bu yüzden kaçırıyor ve aynı araç ikinci kez açılabiliyordu.
 *
 * `normalizePlate` ile aynı normalizasyonu uygular ama **kısmi** girişte de
 * anlamlıdır (arama içindir, kayıt için kanonik değer üretmez). Sonuç, kolonu da
 * aynı şekilde sadeleştiren sorgu tarafında `LIKE %term%` ile karşılaştırılır.
 *
 * Üç karakterden kısa terimlerde `""` döner: hem gereksiz tam tarama olur hem de
 * neredeyse tüm plakalar eşleşir. Çağıran taraf boş terimde kural eklememelidir.
 */
export function plateSearchTerm(input: string): string {
  const normalized = normalizePlate(input)
  return normalized.length >= 3 ? normalized : ""
}

/** Yalnız rakamdan oluşan giriş bu uzunluktan itibaren telefon sayılıp aranır. */
export const PHONE_QUERY_MIN_DIGITS = 7

/**
 * "Müşteri adı veya plaka" kutusunda aramanın başlayıp başlamayacağı.
 *
 * Rakamla başlayan giriş plakadır (il kodu) ya da telefondur. Yalnız il kodu
 * ("34") yazıldığında arama o ildeki bütün araçları döker — kullanıcı aradığı
 * aracı henüz tarif etmemiştir. Bu yüzden il kodundan sonra en az bir harf
 * ("34 K") beklenir. Yalnız rakamdan oluşan giriş telefon uzunluğuna
 * (`PHONE_QUERY_MIN_DIGITS`) gelince aranır; müşteri telefonuyla da bulunabilsin.
 * Harfle başlayan giriş (müşteri adı) olduğu gibi aranır.
 */
export function isPlateOrCustomerQueryReady(input: string): boolean {
  const q = input.trim()
  if (!q) return false
  if (!/^\d/.test(q)) return true
  const compact = normalizePlate(q)
  if (/^\d+$/.test(compact)) return compact.length >= PHONE_QUERY_MIN_DIGITS
  return /^\d{1,2}[A-ZÇĞİÖŞÜ]/.test(compact)
}
