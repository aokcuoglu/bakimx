export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "BakimX mobilde çalışır mı?",
    answer:
      "Evet, BakimX tamamen mobil öncelikli tasarlanmıştır. Telefonunuzdan araç kabul edebilir, fotoğraf çekebilir, iş emri ve teklif oluşturabilirsiniz. Masaüstü cihazlardan da erişim mümkündür.",
  },
  {
    question: "Ruhsat okuma nasıl çalışır? Parça fiyatı veriyor musunuz?",
    answer:
      "Ruhsatın fotoğrafını yükleyin; plaka, marka/model, VIN, model yılı ve sahibi gibi bilgiler otomatik doldurulsun, siz onaylamadan önce kontrol edin. Aracın VIN'iyle eşleşen, ona uygun katalog parçalarını görürsünüz. Parça fiyatlarını biz belirlemeyiz; fiyatlandırma tamamen sizin kendi kataloğunuzdan gelir.",
  },
  {
    question: "Hangi modüller bugün hazır?",
    answer:
      "İş emri, teklif, randevu, takvim, stok/parça, tedarikçi, kasa (tahsilat ve yaşlandırma), müşteri & araç yönetimi, bakım hatırlatmaları, raporlar ve iletişim modülleri bugün kullanıma hazırdır. AI servis danışmanı Premium pakette yer alır.",
  },
  {
    question: "Stok, tedarikçi ve tahsilat takibi var mı?",
    answer:
      "Evet. Parça stoğunuzu kritik eşiklerle takip eder, tedarikçilerinizi yönetir, tahsilatları kasada toplar ve yaşlandırma (alacak) raporu alırsınız.",
  },
  {
    question: "Müşteriye WhatsApp ile çıktı gönderilebilir mi?",
    answer:
      "Evet. Teklif ve iş emri özetini WhatsApp veya link ile doğrudan müşteriye gönderebilir, tarayıcıdan yazdırabilirsiniz. Markalı PDF dışa aktarma yakında ekleniyor.",
  },
  {
    question: "Birden fazla kullanıcı ekleyebilir miyim?",
    answer:
      "Evet. Ekibinizi davet edip rol verebilirsiniz; teknisyen, servis danışmanı ve yönetici farklı yetkilerle çalışır.",
  },
  {
    question: "Verilerim güvende mi?",
    answer:
      "Her servis yalnızca kendi verisini görür ve erişim rol bazlıdır (sahip / yönetici / personel). Platform KVKK uyumlu olacak şekilde geliştiriliyor.",
  },
  {
    question: "Küçük oto tamircileri için uygun mu?",
    answer:
      "Kesinlikle. BakimX, küçük ve orta ölçekli oto tamir atölyeleri için tasarlanmıştır. Tek kişilik kullanıma uygundur ve kurulum için teknik bilgi gerektirmez.",
  },
  {
    question: "Nasıl başlarım? Ücretsiz deneme var mı?",
    answer:
      "\"Ücretsiz Dene\" diyerek iş yeri bilgilerinizle hesabınızı oluşturur ve kartınızı doğrularsınız. Doğrulama sırasında kartınızdan yalnızca 1 TL'lik provizyon alınır ve anında iade edilir; kart doğrulamasının ardından hesabınız anında açılır ve 7 günlük ücretsiz deneme süreniz başlar. Deneme süresince ücret ödemezsiniz; beğenirseniz size uygun pakete geçersiniz.",
  },
  {
    question: "Kurulum için bilgisayar gerekir mi?",
    answer:
      "Hayır. BakimX tarayıcı tabanlı bir platformdur. Telefonunuzun internet tarayıcısından doğrudan erişebilirsiniz. Herhangi bir kurulum veya indirme gerekmez.",
  },
  {
    question: "Fiyatlandırma nasıl çalışıyor? Kullanıcı başı mı, araç başı mı?",
    answer:
      "Aylık sabit abonelik modeli sunuyoruz; araç veya kullanıcı sayısına göre kademeli paketlerimiz var. Detaylı fiyatlar için Fiyatlar sayfamızı inceleyin veya bizimle iletişime geçin.",
  },
  {
    question:
      "Mevcut müşterilerimin ve araçlarımın verisini içeri aktarabilir miyim?",
    answer:
      "Evet. Eski sisteminizden (Excel, başka bir program) veri göçü için ekibimiz size yardımcı olur. İletişime geçtiğinizde göç sürecini birlikte planlarız.",
  },
  {
    question: "Verilerim güvende mi? KVKK uyumluluğu nasıl sağlanıyor?",
    answer:
      "Verileriniz güvenli bulut altyapısında, şifreli olarak saklanır. Açık rıza metni, aydınlatma metni ve çerez politikamız KVKK düzenlemelerine uygundur; verilerinizi talep üzerine dışa aktarabilirsiniz.",
  },
  {
    question: "Kullanmak için teknik bilgi veya eğitim gerekiyor mu?",
    answer:
      "Hayır. BakimX tarayıcı tabanlıdır; her cihazın internet tarayıcısından, kurulum gerektirmeden aynı gün kullanmaya başlarsınız. Arayüz atölye kullanımına göre sadeleştirilmiştir.",
  },
  {
    question: "İstediğim zaman aboneliği iptal edebilir miyim?",
    answer:
      "Evet. Taahhüt yoktur; aylık abonelik modelinde istediğiniz zaman panel üzerinden iptal edebilirsiniz. Verileriniz talep üzerine dışa aktarılır.",
  },
];
