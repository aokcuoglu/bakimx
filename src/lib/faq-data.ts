export interface FaqItem {
  question: string;
  /** Landing'deki yoğun düzen için kısa soru etiketi. */
  landingQuestion?: string;
  answer: string;
}

/**
 * Landing SSS + site asistanı + FAQPage JSON-LD tek kaynağı.
 * Editoryal kural: her madde TEK kısa cevap; aynı konuyu ikinci bir madde
 * tekrar etmez (mükerrer sorular tek başlıkta birleşir).
 */
export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Araç kabulünü hızlandırabilir miyim?",
    answer:
      "Evet. Ruhsatı fotoğrafladığınızda plaka, marka, model, şasi ve model yılı otomatik dolar. Siz yalnızca bilgileri kontrol edip onaylarsınız.",
  },
  {
    question: "Araca uygun parçayı nasıl bulurum?",
    answer:
      "Ruhsattaki şasi numarası araç modeline eşlenir. Katalogda yalnızca o araca uyan parçaları görür, kendi tedarikçi alış fiyatlarınızı karşılaştırabilirsiniz.",
  },
  {
    question: "İş emrini ve müşteri iletişimini nasıl takip ederim?",
    answer:
      "Her iş emrinde teknisyen ataması, kontrol listesi ve işlem geçmişi tutulur. Müşterinize canlı takip linkini WhatsApp üzerinden tek dokunuşla gönderebilirsiniz.",
  },
  {
    question: "Stok ve tedarikçi takibi var mı?",
    answer:
      "Evet. İş emrine parça eklendiğinde stok otomatik düşer; tedarikçilerinizi yönetir, kritik stokları ve kendi alış fiyatlarınızı tek ekrandan izlersiniz.",
  },
  {
    question: "Ekibimi ve yetkileri yönetebilir miyim?",
    answer:
      "Evet. Teknisyen, servis danışmanı ve yönetici rolleri farklı yetkilerle çalışır. Böylece herkes yalnızca ihtiyacı olan bilgilere erişir.",
  },
  {
    question: "Müşteriye WhatsApp'tan çıktı gönderebilir miyim?",
    answer:
      "Evet. Takip linkini veya iş emri özetini WhatsApp üzerinden paylaşabilirsiniz. Müşteriniz linki tarayıcıda açar; uygulama indirmesi gerekmez.",
  },
  {
    question: "BakimX mobilde çalışır mı? Kurulum gerekiyor mu?",
    answer:
      "Evet. Telefon, tablet veya bilgisayarınızın tarayıcısından kullanabilirsiniz. Program indirmeniz gerekmez; aynı hesabınızla servisinizdeki kayıtlara erişirsiniz.",
  },
  {
    question: "Ruhsat okuma nasıl çalışır?",
    answer:
      "Ruhsat fotoğrafından plaka, marka/model, şasi numarası ve model yılı okunur; bilgileri kontrol edip onaylarsınız. Ruhsat okuma Servis Paketi'ne dahil olmayan bir ek özelliktir ve yakında uygulama içinden ayrıca alınabilecek. Plaka okuma ise pakete dahildir.",
  },
  {
    question: "Hangi modüller bugün hazır?",
    answer:
      "İş emri, teklif, randevu, stok/parça, tedarikçi, kasa, müşteri ve araç yönetimi, bakım hatırlatmaları ve raporlar Servis Paketi'nde kullanıma hazır. e-Fatura/e-Arşiv ve çoklu şube yönetimi ek özellik olarak planlanan geliştirmelerdir; henüz kullanıma açık değildir.",
  },
  {
    question: "Stok, tedarikçi ve tahsilat takibi var mı?",
    answer:
      "Evet. Stoğu kritik eşiklerle takip eder, tedarikçilerinizi yönetir, tahsilatları kasada toplar ve yaşlandırma raporu alırsınız.",
  },
  {
    question: "Müşteriye WhatsApp ile çıktı gönderilebilir mi?",
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
    answer:
      "Tek paket var: Servis Paketi aylık ₺1.499 (KDV dahil), yıllık ödemede ₺14.990 — 2 ay bedava. Pakette 5 kullanıcı vardır; daha fazlası için bizimle iletişime geçebilirsiniz. Şaseden parça, ruhsat okuma, AI danışmanı, e-Fatura ve çoklu şube pakete dahil değildir; ek özellik olarak yakında uygulama içinden alınabilecek.",
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
