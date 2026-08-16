/**
 * Landing'deki soru→cevap kartlarının tek kaynağı (BAK-80).
 *
 * Aynı veri üç yerde kullanılır ve üç ayrı metin tutulmaz:
 *   1. hero'nun sağ kolonundaki kayan kart şeridi (`ObjectionCards`),
 *   2. SSS akordiyonunun ilk grubu (`FAQSection`) — kartların bağlandığı hedef,
 *   3. Faz 3'te (BAK-81) ask bar'ın hazır soru çipleri.
 *
 * Metin kuralı: her cevap BUGÜN prod'da çalışan bir davranışı anlatır. Ölçülmemiş
 * metrik ("%40 hızlı"), parça fiyatı vaadi ve yalnız mock sağlayıcıyla çalışan
 * özellik buraya yazılmaz. Son maddede fiyatın "kendi tedarikçi alış fiyatlarınız"
 * olduğu açıkça söylenir — canlı piyasa fiyatı çekmiyoruz.
 */
export type LandingObjection = {
  /** Kararlı kimlik: görsel dosya adı ve SSS çapası bundan türetilir. */
  id: string;
  /** Müşterinin kendi cümlesi — kartta tırnak içinde gösterilir. */
  question: string;
  /** Tek cümlelik cevap. */
  answer: string;
  /** Gerçek ürün ekranından alınmış kanıt görseli. */
  screenshot: string;
  /** Görselin ne gösterdiği — dekoratif değil, açıklayıcı alt metin. */
  screenshotAlt: string;
  /**
   * Kart tıklandığında gidilecek yer. Bugün SSS'teki karşılığı; Faz 3'te
   * ask bar bağlanınca tıklama oraya düşer, bu link yedek (ve JS'siz yol) kalır.
   */
  href: string;
};

/** SSS akordiyonunda bu itirazın DOM `id`'si — derin link hedefi. */
export function objectionFaqAnchor(id: string): string {
  return `sss-${id}`;
}

function objection(
  id: string,
  question: string,
  answer: string,
  screenshotAlt: string
): LandingObjection {
  return {
    id,
    question,
    answer,
    screenshot: `/landing/objections/${id}.png`,
    screenshotAlt,
    href: `/#${objectionFaqAnchor(id)}`,
  };
}

export const LANDING_OBJECTIONS: LandingObjection[] = [
  objection(
    "dis-alim-parca",
    "Dışarıdan alınan parçayı takip edemiyorum",
    'Teknisyen "Parça Aldım" der, kutunun fotoğrafını çeker; okunan bilgiler öneri olarak gelir ve parça iş emri kalemine düşer.',
    "Teknisyen ekranında dış alım parçasının fotoğrafla kaydedildiği pencere"
  ),
  objection(
    "uyumlu-parca",
    "Araca hangi parça uyuyor bilmiyorum",
    "Ruhsattaki şasi numarası araç modeline eşlenir; katalogda yalnız o araca uyan parçalar listelenir.",
    "Araca uygun parçaların listelendiği parça kataloğu ekranı"
  ),
  objection(
    "hizli-kabul",
    "Araç kabulü yarım saat sürüyor",
    "Ruhsatı okutun; plaka, marka, model, şasi ve model yılı otomatik dolar, siz yalnızca kontrol edip onaylarsınız.",
    "Ruhsat okutma adımında araç bilgilerinin otomatik dolduğu form"
  ),
  objection(
    "musteri-arayisi",
    "Müşteri her gün arayıp aracını soruyor",
    "Her iş emrinin kişiye özel canlı takip linki vardır; WhatsApp'tan tek dokunuşla gönderirsiniz.",
    "Müşterinin telefonundan gördüğü canlı iş emri takip sayfası"
  ),
  objection(
    "hasar-kanit",
    "Hasar bizden mi değil mi tartışması çıkıyor",
    "Kabulde fotoğraf kontrol listesi ve hasar haritası doldurulur; kaydedilen kanıt sonradan silinmez.",
    "Araç kabulünde hasar haritası ve fotoğraf kontrol listesi ekranı"
  ),
  objection(
    "is-takibi",
    "Hangi işi kim, ne zaman yaptı bilmiyorum",
    "Her iş emrinde teknisyen ataması, zorunlu kontrol listesi ve zaman damgalı işlem geçmişi tutulur.",
    "İş emrindeki teknisyen ataması ve zaman damgalı işlem geçmişi"
  ),
  objection(
    "stok-dusumu",
    "Stok elimde tutmuyor",
    "İş emrine parça eklendiğinde stok otomatik düşer; stok yetmiyorsa kalem hiç eklenmez.",
    "Parça stok listesi ve kritik stok uyarıları"
  ),
  objection(
    "tedarikci-fiyat",
    "Fiyat verirken tedarikçileri karşılaştıramıyorum",
    "Parça başına kendi tedarikçi alış fiyatlarınız tek ekranda yan yana görünür.",
    "Bir parçanın tedarikçi bazlı alış fiyatlarının karşılaştırıldığı ekran"
  ),
];
