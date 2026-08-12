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
