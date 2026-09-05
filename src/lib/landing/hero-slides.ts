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
    eyebrow: "İş Emri + Parça Bulma",
    title: "Oto servisinizde iş emri açmak ve parça bulmak",
    highlight: "artık 10 saniye.",
    description:
      "Ruhsatı taratarak aracı saniyeler içinde tanıyın; dijital iş emrini başlatın ve şaseye uygun parçaları aynı akışta bulun.",
    bullets: [
      "Ruhsattan otomatik araç tanıma",
      "10 saniyede dijital iş emri",
      "Şaseye uygun parça bulma",
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
    eyebrow: "Araca Uygun Parçalar",
    title: "Araca uyan parçayı bulun,",
    highlight: "iş emrine tek tıkla ekleyin.",
    description:
      "Şase numarasına göre yalnızca o araca uyan parçaları görün; elle arama ve yanlış parça riskini azaltın.",
    bullets: [
      "Şaseye göre araç tanıma",
      "Araca uygun parça listesi",
      "Tek tıkla iş emrine ekleme",
    ],
    image: "/landing/hero/compatible-parts.webp",
    imagePosition: "72% center",
  },
] as const satisfies readonly HeroSlide[];
