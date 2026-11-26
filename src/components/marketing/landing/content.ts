/**
 * Ana sayfa metinleri — e-santral.com/bakimx ile kelimesi kelimesine aynı
 * (docs/design/esantral-reference/index.html). İstisnalar sahip kararlarıdır:
 * spec §6.1'deki üç revizyon (PRICE.subtitle, PRICE.items[1],
 * LANDING_FAQ[0].answer) — "ek maliyetli kısımlar uygulama içinde satılır"
 * (22-11-2026, #781/#782) — ve #782'nin kapsam düzeltmesi: ruhsat OCR ek
 * özellik, plaka okuma pakete dahil (PRICE.items[1], DAY_CARDS[0].text), e-Fatura
 * ek özellik (LANDING_FAQ[3].answer). Fiyat `SERVICE_PACKAGE` ile aynı kalmak
 * zorunda; content.test.ts bekçidir.
 */
import type { FeatureIconName } from "./feature-icons"

export const LANDING_DESCRIPTION =
  "Oto servisinizi telefonunuzdan yönetin. İş emri, parça, stok, kasa ve randevu tek yerde. Tek paket, her zaman ₺1.499."

export const NAV = [
  { label: "Nasıl çalışır", id: "nasil" },
  { label: "Özellikler", id: "ozellikler" },
  { label: "Fiyat", id: "fiyat" },
  { label: "Sorular", id: "sorular" },
] as const

export const CTA = {
  trial: "Ücretsiz deneyin",
  callback: "Sizi arayalım",
  login: "Giriş yap",
} as const

export const HERO = {
  title: ["Oto servisinizi", "telefonunuzdan yönetin."],
  subtitle: "Araç kabul, parça takibi, stok, kasa ve randevu. Hepsi cebinizde.",
  image: {
    src: "/landing/esantral/eller-telefon.webp",
    alt: "Ustanın elinde BakımX açık telefon",
    width: 1672,
    height: 941,
  },
} as const

/** Hero telefonundaki uygulama maketi — sentetik örnek veri. */
export const MOCKUP = {
  avatar: "MU",
  workshop: "Yıldız Oto Servis",
  date: "Bugün · Cumartesi, 22 Kasım",
  stats: [
    { value: "7", label: "Serviste" },
    { value: "3", label: "Hazır" },
    { value: "₺18,4B", label: "Kasa" },
  ],
  rows: [
    { plate: "34 ABC 123", car: "Ford Transit", job: "Yağ, filtre, ön balata", status: "warn", label: "İşlemde" },
    { plate: "34 LKN 123", car: "Peugeot 508", job: "Periyodik bakım", status: "info", label: "Kabul" },
    { plate: "06 BRS 41", car: "Fiat Egea", job: "Fren diski", status: "warn", label: "Parça" },
    { plate: "16 TR 552", car: "Toyota Corolla", job: "Triger seti", status: "ok", label: "Hazır" },
  ],
  section: "Az önce",
  notes: [
    { kind: "whatsapp", title: "34 ABC 123 onaylandı", text: "Müşteri WhatsApp'tan onayladı · ₺6.450" },
    { kind: "calendar", badge: "14:30", title: "Sıradaki randevu", text: "06 KLM 204 · Hyundai i20 · Bakım" },
    { kind: "stock", badge: "!", title: "Stok azaldı", text: "Polen filtresi · son 1 adet" },
  ],
  tabs: ["Bugün", "İş emirleri", "Stok", "Kasa"],
} as const

export const DAY_STRIP = {
  /** Başlık "BakımX" wordmark'ından sonra gelir. */
  titleAfterMark: "ile dükkanınızda bir gün.",
} as const

export const DAY_CARDS = [
  {
    img: "/landing/esantral/kabul.webp",
    alt: "Usta, servis girişinde müşterinin aracının fotoğrafını telefonla çekiyor",
    label: "Araç Kabul",
    text: "Araç kabul: plaka okuma ve aracın fotoğraflarının çekilmesi. Evet bu kadar hızlı.",
  },
  {
    img: "/landing/esantral/parca.webp",
    alt: "Usta, parça rafından yağ filtresi kutusu alıyor",
    label: "Parça Ekleme",
    text: "Parçayı stoğunuzdan seçip iş emrine ekleyin, stok kendiliğinden düşsün. Şaseden parça sorgulama ek özelliktir.",
  },
  {
    img: "/landing/esantral/teslim.webp",
    alt: "Usta, bakımı biten aracın anahtarını müşteriye veriyor",
    label: "Müşteri Bilgilendirme",
    text: "Müşteriniz aracının durumunu anlık takip edebilir, yapılan işlemleri görebilir, tekrar tekrar size sormasına gerek kalmaz.",
  },
  {
    img: "/landing/esantral/usta.webp",
    alt: "Atölyesinde elinde çay bardağı ve telefonla oturan usta",
    label: "Hesabınız Hazır",
    text: "Siz çayınızı bile bitiremeden hesabınız hazır. Üstelik, telefon, tablet, bilgisayar nereden isterseniz orada.",
  },
] as const

export const FEATURES = {
  /** Başlık "BakımX" wordmark'ından sonra gelir. */
  titleAfterMark: "diğer özellikleri",
} as const

export const FEATURE_TILES: readonly { icon: FeatureIconName; title: string; text: string }[] = [
  { icon: "history", title: "Araç geçmişi", text: "Plakayı yazın, aracın önceki kayıtlarını ve takılan parçaları görün." },
  { icon: "receipt", title: "Açık hesaplar", text: "Ödenmemiş tutarları müşteri bazında listeleyin." },
  { icon: "calendar", title: "Randevu takvimi", text: "Randevuları takvimde planlayın, günün işini önceden görün." },
  { icon: "bell", title: "Bakım hatırlatma", text: "Bakım zamanı gelen müşterilere otomatik hatırlatma gönderin." },
  { icon: "package", title: "Stok ve tedarikçiler", text: "Stok miktarını, kritik seviyeleri ve tedarikçilerinizi takip edin." },
  { icon: "users", title: "Ekip ve yetkiler", text: "Yönetici, servis danışmanı ve teknisyen kendi yetkisiyle çalışır." },
]

export const MOVE = {
  title: "Eski sistemden sizi biz taşıyoruz.",
  dim: "Excel'inizden bile.",
  text: "BakımX'e geçerken işleriniz aksamasın, mevcut müşteri ve araç kayıtlarınızı, ekibinizi ve yetkileri birlikte taşıyalım.",
  steps: [
    { title: "Servisinizi konuşalım.", text: "İş akışınızı ve ihtiyaçlarınızı birlikte inceleyelim." },
    { title: "Kayıtlarınızı taşıyalım.", text: "Eski müşteri ve araç kayıtlarınız BakımX'e aktarılsın." },
    { title: "Servis hafızanız hazır.", text: "Ekranlar yeni, geri kalan her şey tanıdık." },
  ],
} as const

export const PRICE = {
  title: "Tek paket, her zaman.",
  subtitle: "Servisinizin günlük işi için gereken her şey dahil. Kademeli paket, gizli ücret yok.",
  amount: "₺1.499",
  unit: "/ ay, KDV dahil",
  monthlyPriceTry: 1499,
  items: [
    "Sınırsız müşteri ve araç kabul",
    "Plaka okuma ile hızlı araç kabul",
    "Fotoğraflı kabul ve hasar kaydı",
    "Kasa, tahsilat ve randevu",
    "WhatsApp'tan müşteri bilgilendirme",
    "Stok, hatırlatma, ekip yetkileri",
  ],
  note: "Kart bilgisi istenmez.",
} as const

export const FAQ_TITLE = "Sık sorulan sorular"

export const LANDING_FAQ = [
  {
    question: "Fiyata neler dahil?",
    answer:
      "Tek paket var: servisinizi yönetmek için gereken her şey aylık ₺1.499'a (KDV dahil) dahildir. Şaseden parça sorgulama gibi ek maliyetli hizmetleri isterseniz uygulama içinden ayrıca alabilirsiniz.",
  },
  {
    question: "Müşteriye WhatsApp'tan ne gönderiliyor?",
    answer:
      "İş emrinin paylaşım bağlantısı gider. Müşteri aracının durumunu, yapılan işleri, takılan parçaları ve tutarı bu bağlantıdan görür.",
  },
  {
    question: "Ekibim de kullanabilir mi?",
    answer: "Evet. Yönetici, servis danışmanı ve teknisyen kendi yetkisiyle giriş yapar.",
  },
  {
    question: "e-Fatura kesebilir miyim?",
    answer: "e-Fatura ve e-Arşiv yakında ek özellik olarak ekleniyor; uygulama içinden ayrıca alabileceksiniz.",
  },
  {
    question: "Hangi cihazlarda çalışır?",
    answer: "Telefon, tablet ve bilgisayarda tarayıcıdan çalışır. Program indirmeniz gerekmez.",
  },
] as const

export const FINAL = {
  /** Başlık "BakımX" wordmark'ından sonra gelir. */
  titleAfterMark: "'i ücretsiz deneyin.",
  whatsapp: "WhatsApp'tan sorun",
  whatsappMessage: "Merhaba, BakımX hakkında bilgi almak istiyorum.",
} as const

export const FOOTER = {
  copyright: "© 2026 BakımX",
  legal: [
    { label: "KVKK aydınlatma metni", href: "/kvkk" },
    { label: "Gizlilik", href: "/privacy" },
    { label: "Kullanım koşulları", href: "/terms" },
  ],
} as const
