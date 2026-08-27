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
    eyebrow: "Dijital Araç Kabul",
    title: "Ruhsatı okutun,",
    highlight: "iş emrini saniyeler içinde açın.",
    description:
      "Araç bilgilerini tek tek yazmadan kayda alın; fotoğraflı kabul sürecini servisin her noktasından başlatın.",
    bullets: [
      "Ruhsattan otomatik araç bilgisi",
      "Fotoğraflı kabul kaydı",
      "Mobil ve kurulumsuz kullanım",
    ],
    image: "/landing/hero/digital-intake.webp",
    imagePosition: "72% center",
  },
  {
    id: "photo-evidence",
    eyebrow: "Dijital İş Emri",
    title: "Yapılan her işi",
    highlight: "kanıtıyla belgeleyin.",
    description:
      "Fotoğrafı, hasar kaydını, parça ve işçiliği aynı iş emrinde tutun; kabulden teslimata hiçbir ayrıntı kaybolmasın.",
    bullets: [
      "Değiştirilemez fotoğraf kanıtı",
      "Hasar haritası ve kontrol listesi",
      "Teklif, onay ve tahsilat takibi",
    ],
    image: "/landing/hero/photo-evidence.webp",
    imagePosition: "73% center",
  },
  {
    id: "compatible-parts",
    eyebrow: "VIN Uyumlu Parçalar",
    title: "Araca uyan parçayı bulun,",
    highlight: "iş emrine tek tıkla ekleyin.",
    description:
      "VIN eşleşmesiyle yalnızca araca uygun katalog parçalarını görün; elle arama ve yanlış parça riskini azaltın.",
    bullets: [
      "VIN ile araç eşleşmesi",
      "Araca uygun katalog parçaları",
      "Tek tıkla iş emrine ekleme",
    ],
    image: "/landing/hero/compatible-parts.webp",
    imagePosition: "72% center",
  },
] as const satisfies readonly HeroSlide[];
