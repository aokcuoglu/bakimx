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
      "Evet. Telefon, tablet veya bilgisayarınızın tarayıcısından kullanabilirsiniz. Program indirmeniz gerekmez; aynı hesabınızla servisinizdeki kayıtlara erişirsiniz.",
  },
  {
    question: "Ruhsat okuma nasıl çalışır?",
    showOnLanding: true,
    answer:
      "Ruhsat fotoğrafından plaka, marka/model, şasi numarası ve model yılı okunur. Bilgileri kontrol edip onaylarsınız. Araç eşleştirmesi yapıldığında ilgili katalog parçalarını inceleyebilirsiniz; fiyatlar kendi kataloğunuzdan gelir.",
  },
  {
    question: "Hangi modüller bugün hazır?",
    showOnLanding: true,
    answer:
      "İş emri, teklif, randevu, stok/parça, tedarikçi, kasa, müşteri ve araç yönetimi, bakım hatırlatmaları ve raporlar kullanıma hazır. Modül ve kullanım hakları pakete göre değişir. e-Fatura/e-Arşiv ve çoklu şube yönetimi planlanan geliştirmelerdir; henüz kullanıma açık değildir.",
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
      "Evet. Müşterinize takip linkini veya iş emri özetini WhatsApp üzerinden paylaşabilirsiniz. Müşteriniz linki tarayıcıda açar; uygulama indirmesi gerekmez. Yazdırılabilir çıktıları tarayıcınızdan PDF olarak da kaydedebilirsiniz.",
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
      '"Ücretsiz Dene" ile paket veya kart seçmeden hesabınızı açarsınız. E-posta doğrulamasından sonra 7 iş günü ücretsiz kullanırsınız; satın alma yapılmazsa verileriniz korunarak üyeliğiniz dondurulur.',
  },
  {
    question: "Fiyatlandırma nasıl çalışıyor?",
    showOnLanding: true,
    answer:
      "Lite, Profesyonel ve Premium paketlerini Fiyatlar sayfasında karşılaştırabilirsiniz. Özellikler, dahil kullanıcı sayısı ve kullanım kotaları pakete göre değişir. Güncel aylık ve yıllık tutarlar aynı sayfada yer alır.",
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
