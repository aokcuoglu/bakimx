export type HeroSlide = {
  id: string;
  eyebrow: string;
  title: string;
  highlight: string;
  description: string;
  bullets: readonly [string, string, string];
  image: string;
  imagePosition: string;
};

/**
 * Landing hero metinlerinin tek kaynağı. Her vaat bugün üründe bulunan bir
 * akışa dayanır; görseller temsilidir ve arayüz/özellik kanıtı sayılmaz.
 */
export const HERO_SLIDES = [
  {
    id: "digital-intake",
    eyebrow: "Mobil Araç Kabul + Ruhsat Okuma",
    title: "Oto servisinizde iş emri açmak ve parça bulmak",
    highlight: "artık 10 saniye.",
    description:
      "Ruhsat okutarak araca %100 uyumlu yedek parçaları anında bulun, tek tıkla iş emrine ekleyin. Yanlış parça siparişi ve zaman kaybına son verin.",
    bullets: [
      "Ruhsattan şase ve araç tanıma",
      "%100 uyumlu yedek parça sonuçları",
      "Tek tıkla iş emrine ekleme",
    ],
    image: "/landing/hero/digital-intake.webp",
    imagePosition: "72% center",
  },
  {
    id: "compatible-parts",
    eyebrow: "Şaseden Araç Tanıma + Parça Stok",
    title: "Şaseyi girin.",
    highlight: "Doğru aracı, doğru parçayla eşleştirin.",
    description:
      "Şase numarasıyla araç bilgilerini getirin ve uyumlu parça sonuçlarını görün; iş emrine eklenen stoklu parçaları servis stoğunuzdan otomatik düşün.",
    bullets: [
      "Şaseden marka-model eşleştirme",
      "Araca uygun parça sonuçları",
      "İş emriyle bağlı stok takibi",
    ],
    image: "/landing/hero/compatible-parts.webp",
    imagePosition: "72% center",
  },
  {
    id: "photo-evidence",
    eyebrow: "Fotoğraflı Dijital İş Emri",
    title: "Yapılan her işi",
    highlight: "kanıtıyla aynı kayıtta tutun.",
    description:
      "Fotoğrafı, hasar kaydını, parça ve işçiliği aynı iş emrinde tutun; kabulden teslimata servis ekibiniz güncel kaydı birlikte takip etsin.",
    bullets: [
      "Değiştirilemez fotoğraf kanıtı",
      "Hasar haritası ve kontrol listesi",
      "Teklif, onay ve tahsilat takibi",
    ],
    image: "/landing/hero/photo-evidence.webp",
    imagePosition: "73% center",
  },
] as const satisfies readonly HeroSlide[];
