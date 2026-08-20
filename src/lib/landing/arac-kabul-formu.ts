export const ARAC_KABUL_FORMU_PATH = "/rehber/arac-kabul-formu" as const

export const ARAC_KABUL_FORMU_TITLE = "Araç Kabul Formu: Sahada Uygulanabilir 8 Adımlık Kontrol Listesi"

export const ARAC_KABUL_FORMU_H1 = "Araç kabul formu: eksiksiz kabul için 8 adımlık kontrol listesi"

export const ARAC_KABUL_FORMU_DESCRIPTION =
  "Araç kabul formu kontrol listesi: ruhsat, kilometre, zorunlu fotoğraf açıları ve hasar tespitini kapsayan 8 adımlık sahada uygulanabilir süreç. Yazdırın veya dijital araç kabul akışında tamamlayın."

export const ARAC_KABUL_FORMU_INTRO =
  "Araç kabul formu; bir araç servise girerken danışman veya teknisyenin sırayla uyguladığı kontrol listesidir. Müşteri şikâyeti, ruhsat ve araç bilgisi, kilometre/yakıt durumu, zorunlu kabul fotoğrafları, mevcut hasarın tespiti ve müşteri onayını kapsar. Aşağıdaki 8 adım BakımX ürün ekibi tarafından incelenmiş, sahada doğrudan uygulanabilecek sırayla verilmiştir; yazdırıp elle işaretleyebilir ya da dijital araç kabul akışında tek dokunuşla tamamlayabilirsiniz."

export const ARAC_KABUL_FORMU_BOUNDARY =
  "Bu rehber; araç kabulünü sahada standartlaştırmak isteyen bir oto servis danışmanının veya teknisyeninin kullanacağı operasyonel bir kontrol listesidir. Bir hukuki form şablonu, sigorta eksper raporu veya KVKK danışmanlığı değildir; ağır hasar/kaza sonrası resmi ekspertiz gerekiyorsa bu liste tek başına yeterli değildir. İndirilebilir bir belge sunmaz, adımları BakımX'in gerçek dijital araç kabul ekranı üzerinden gösterir."

export const ARAC_KABUL_FORMU_CHECKLIST = [
  {
    title: "Müşteri şikâyetini dinleyin ve not edin",
    description: "Aracı getiren kişiden şikâyeti veya talebi dinleyin, kendi cümleleriyle kısaca kaydedin.",
  },
  {
    title: "Ruhsat bilgisini kontrol edin",
    description: "Plaka, marka/model, şasi (VIN) ve model yılını ruhsattan doğrulayın.",
  },
  {
    title: "Kilometre ve yakıt seviyesini not edin",
    description: "Gösterge panelindeki kilometreyi ve yakıt seviyesini kaydedin; teslimde karşılaştırma referansı olur.",
  },
  {
    title: "Zorunlu kabul fotoğraflarını çekin",
    description: "Ön, arka, sağ yan, sol yan ve gösterge paneli fotoğraflarını çekin; eksik kareyi ayrıca not edin.",
  },
  {
    title: "Aracın dış yüzeyini gözden geçirin",
    description: "Aracın etrafında dolaşarak mevcut çizik, göçük veya boya hasarını gözle inceleyin.",
  },
  {
    title: "Hasarı konum ve türüyle işaretleyin",
    description: "Tespit ettiğiniz her hasarı bölge, tür ve derecesiyle kaydedin; teslimde tartışma çıkmaması için zaman damgalı kanıt bırakır.",
  },
  {
    title: "Araçta bırakılan eşyayı not edin",
    description: "Araç içinde bırakılan kişisel veya değerli eşyayı müşteriyle birlikte kontrol edip kaydedin.",
  },
  {
    title: "Kabulü onaylatın ve iş emrine bağlayın",
    description: "Kaydı müşteriye gösterip onayını alın, ardından iş emrini oluşturup kabul kaydına bağlayın.",
  },
] as const

export const ARAC_KABUL_FORMU_FAQS = [
  {
    question: "Araç kabul formu neden önemli?",
    answer:
      "Kabul formu, aracın servise girdiği andaki durumunu (hasar, kilometre, eşya) kayıt altına alır. Bu kayıt olmadan teslimde çıkan bir anlaşmazlıkta elinizde kanıt kalmaz; sahada uygulanan sabit bir sıra bu riski azaltır.",
  },
  {
    question: "Bu sayfa indirilebilir bir form şablonu mu sunuyor?",
    answer:
      "Hayır, bu sayfa hukuki bir form şablonu değildir; sahada uygulanacak adım sırasını anlatan bir rehberdir. Aşağıdaki kontrol listesini yazdırıp elle işaretleyebilir veya BakımX'in dijital araç kabul akışında adım adım tamamlayabilirsiniz.",
  },
  {
    question: "Kabul fotoğrafı kaç açıdan çekilmeli?",
    answer:
      "En az ön, arka, sağ yan, sol yan ve gösterge paneli olmak üzere beş açı zorunludur. Hasarlı bölge varsa yakın çekim fotoğraf eklemek teslim sırasında karşılaştırmayı kolaylaştırır.",
  },
  {
    question: "Araçta hasar yoksa bu adım atlanır mı?",
    answer:
      "Hayır, adımı boş bırakmak yerine 'hasar yok' notu düşüp bir sonraki adıma geçin. Açıkça belirtilmiş bir 'hasar yok' kaydı, teslimde ispat kolaylığı sağlar; boş bırakılan alan sonradan yorum farkına açıktır.",
  },
  {
    question: "Kabul kaydı iş emriyle nasıl ilişkilendirilir?",
    answer:
      "Kağıt kabul formunda bu bağlantı elle takip edilir ve kaybolabilir. Dijital araç kabul akışında kabul kaydı otomatik olarak oluşturduğunuz iş emrine bağlanır, ekip aracın durumunu tek kayıttan görür.",
  },
] as const

export const ARAC_KABUL_FORMU_CONTENT_OWNER = {
  role: "BakımX Ürün Ekibi",
  publishedAt: "2026-08-20",
  updatedAt: "2026-08-20",
} as const

export const ARAC_KABUL_FORMU_SOURCES = [
  { label: "BakımX dijital araç kabul ürün sayfası", href: "/dijital-arac-kabul" },
  { label: "BakımX iş emri programı ürün sayfası", href: "/is-emri-programi" },
] as const
