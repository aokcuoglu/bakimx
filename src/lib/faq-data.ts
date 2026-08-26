export interface FaqItem {
  question: string;
  answer: string;
  /** Landing'de öne çıkarılacak temel sorular; tüm maddeler Asistan'da kalır. */
  showOnLanding?: boolean;
}

/**
 * Landing SSS + site asistanı + FAQPage JSON-LD tek kaynağı.
 * Editoryal kural: her madde TEK kısa cevap; aynı konuyu ikinci bir madde
 * tekrar etmez (mükerrer sorular tek başlıkta birleşir).
 */
export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "BakimX mobilde çalışır mı? Kurulum gerekiyor mu?",
    showOnLanding: true,
    answer:
      "Evet. Tarayıcı tabanlıdır; telefon, tablet veya bilgisayardan kurulumsuz erişilir. Teknik bilgi veya eğitim gerekmez.",
  },
  {
    question: "Ruhsat okuma nasıl çalışır?",
    showOnLanding: true,
    answer:
      "Ruhsatın fotoğrafını yükleyin; plaka, marka/model, VIN ve model yılı otomatik dolsun, siz onaylamadan önce kontrol edersiniz. VIN'e uygun katalog parçalarını görürsünüz; fiyatlandırma kendi kataloğunuzdan gelir.",
  },
  {
    question: "Hangi modüller bugün hazır?",
    showOnLanding: true,
    answer:
      "İş emri, teklif, randevu, stok/parça, tedarikçi, kasa, müşteri & araç yönetimi, bakım hatırlatmaları, raporlar ve iletişim. AI servis danışmanı Premium pakettedir.",
  },
  {
    question: "Stok, tedarikçi ve tahsilat takibi var mı?",
    answer:
      "Evet. Stoğu kritik eşiklerle takip eder, tedarikçilerinizi yönetir, tahsilatları kasada toplar ve yaşlandırma raporu alırsınız.",
  },
  {
    question: "Müşteriye WhatsApp ile çıktı gönderilebilir mi?",
    showOnLanding: true,
    answer:
      "Evet. Teklif ve iş emri özetini WhatsApp veya link ile gönderir, tarayıcıdan yazdırırsınız. Markalı PDF dışa aktarma yakında ekleniyor.",
  },
  {
    question: "Birden fazla kullanıcı ekleyebilir miyim?",
    answer:
      "Evet. Teknisyen, servis danışmanı ve yönetici rolleri farklı yetkilerle çalışır.",
  },
  {
    question: "Verilerim güvende mi?",
    answer:
      "Her servis yalnızca kendi verisini görür; erişim rol bazlıdır. Veriler şifreli saklanır ve açık rıza, aydınlatma metni ile çerez politikası KVKK'ya uygundur.",
  },
  {
    question: "Küçük oto tamircileri için uygun mu?",
    answer:
      "Evet. Tek kişilik kullanımdan ekip çalışmasına kadar ölçeklenir; kurulum için teknik bilgi gerektirmez.",
  },
  {
    question: "Ücretsiz deneme nasıl başlar?",
    answer:
      "\"Ücretsiz Dene\" ile hesabınızı açar, kartınızı doğrularsınız; doğrulamada yalnız 1 TL provizyon alınır ve anında iade edilir. 7 gün ücretsiz kullanırsınız, süre boyunca ücret alınmaz.",
  },
  {
    question: "Fiyatlandırma nasıl çalışıyor?",
    showOnLanding: true,
    answer:
      "Aylık sabit abonelik; araç ve kullanıcı sayısına göre kademeli paketler vardır. Detaylar Fiyatlar sayfasındadır.",
  },
  {
    question: "Mevcut verilerimi içeri aktarabilir miyim?",
    answer:
      "Evet. Excel veya eski programınızdan veri göçü için ekibimiz sizinle birlikte planlar.",
  },
  {
    question: "İstediğim zaman iptal edebilir miyim?",
    answer:
      "Evet. Taahhüt yoktur; panel üzerinden iptal edersiniz, verileriniz talep üzerine dışa aktarılır.",
  },
];

/**
 * Ana sayfada kısa tutulan editoryal seçim. Diğer maddeler silinmez;
 * Asistan'ın arama ve tam SSS görünümünde kullanılmaya devam eder.
 */
export const LANDING_FAQ_ITEMS = FAQ_ITEMS.filter((item) => item.showOnLanding);
