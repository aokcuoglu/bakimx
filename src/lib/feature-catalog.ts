import type { GatedFeature, PlanTier } from "@/lib/plan"

export type FeatureDefinition = {
  name: string
  title: string
  description: string
  benefits: readonly string[]
  countLabel: string
  targetTier: Extract<PlanTier, "pro" | "premium">
}

const PRO_DEFAULT = {
  targetTier: "pro" as const,
  benefits: [
    "Daha hızlı ve standart operasyon akışları",
    "Ekip ve müşteri iletişiminde daha az manuel takip",
    "Kayıtlarınızı silmeden kaldığınız yerden devam",
  ],
}

export const FEATURE_CATALOG: Record<GatedFeature, FeatureDefinition> = {
  quotes: {
    ...PRO_DEFAULT,
    name: "Teklifler",
    title: "Profesyonel tekliflerle onayı hızlandırın",
    description: "Kalemli teklif hazırlayın, müşteriye gönderin ve onaylanan teklifi iş emrine dönüştürün.",
    countLabel: "teklif kaydınız korunuyor",
  },
  appointments: {
    ...PRO_DEFAULT,
    name: "Randevular ve takvim",
    title: "Servis takviminizi tek ekrandan yönetin",
    description: "Randevu oluşturun, kapasiteyi görün ve kabul sürecini planlayın.",
    countLabel: "randevu kaydınız korunuyor",
  },
  automatedReminders: {
    ...PRO_DEFAULT,
    name: "Otomatik hatırlatmalar",
    title: "Müşterileri doğru zamanda otomatik hatırlatın",
    description: "Randevu ve bakım hatırlatmalarını kurallara göre otomatik gönderin.",
    countLabel: "hatırlatma kaydınız korunuyor",
  },
  team: {
    ...PRO_DEFAULT,
    name: "Ekip ve teknisyenler",
    title: "İşleri ekibinize atayın ve ilerlemeyi izleyin",
    description: "Teknisyen hesapları, görev atama ve ekip performansı Profesyonel pakete dahildir.",
    countLabel: "ekip kaydınız korunuyor",
  },
  partsInventory: {
    ...PRO_DEFAULT,
    name: "Stok ve işçilik kataloğu",
    title: "Stok ve işçilik maliyetini kontrol altında tutun",
    description: "Parça stoklarını, kritik seviyeleri ve standart işçilik kalemlerini yönetin.",
    countLabel: "stok kaydınız korunuyor",
  },
  procurement: {
    ...PRO_DEFAULT,
    name: "Tedarik ve satın alma",
    title: "Satın alma sürecini iş emrine bağlayın",
    description: "Tedarikçileri, dış alımları ve katalog siparişlerini tek akışta yönetin.",
    countLabel: "satın alma kaydınız korunuyor",
  },
  cashbox: {
    ...PRO_DEFAULT,
    name: "Kasa ve tahsilat",
    title: "Tahsilatları ve açık alacakları anlık izleyin",
    description: "Ödemeleri kaydedin, yaşlandırmayı görün ve geciken alacakları takip edin.",
    countLabel: "tahsilat kaydınız korunuyor",
  },
  analytics: {
    ...PRO_DEFAULT,
    name: "Operasyonel analiz",
    title: "Servisinizin performansını veriye dönüştürün",
    description: "Geciken işler, gelir, müşteri ve teknisyen göstergelerini birlikte inceleyin.",
    countLabel: "iş emri analiz için hazır",
  },
  reports: {
    ...PRO_DEFAULT,
    name: "Raporlar ve dışa aktarma",
    title: "Yönetim raporlarını birkaç tıkla hazırlayın",
    description: "İş emri, müşteri, tahsilat, parça ve teknisyen raporlarını görüntüleyip dışa aktarın.",
    countLabel: "iş emri raporlamaya hazır",
  },
  communications: {
    ...PRO_DEFAULT,
    name: "İletişim kayıtları",
    title: "Müşteri iletişimini tek yerde takip edin",
    description: "Gönderimleri, teslim durumlarını ve iletişim şablonlarını merkezi olarak yönetin.",
    countLabel: "iletişim kaydınız korunuyor",
  },
  vehiclePassport: {
    ...PRO_DEFAULT,
    name: "Araç pasaportu",
    title: "Servis geçmişini güvenli bir araç pasaportunda paylaşın",
    description: "Müşteriye kontrollü bir geçmiş bağlantısı sunun ve erişimi yönetin.",
    countLabel: "araç pasaportu kaydınız korunuyor",
  },
  ocrIntake: {
    ...PRO_DEFAULT,
    name: "Ruhsat OCR",
    title: "Ruhsat bilgilerini saniyeler içinde aktarın",
    description: "Ruhsat fotoğrafından müşteri ve araç alanlarını otomatik doldurun.",
    countLabel: "araç kaydınız hazır",
  },
  photoChecklist: {
    ...PRO_DEFAULT,
    name: "Fotoğraf kontrol listesi",
    title: "Araç kabul fotoğraflarını standartlaştırın",
    description: "Eksik açıları görün ve teslim öncesi fotoğraf kontrolünü tamamlayın.",
    countLabel: "fotoğraf kaydınız korunuyor",
  },
  damageMap: {
    ...PRO_DEFAULT,
    name: "Hasar haritası",
    title: "Mevcut hasarları araç üzerinde işaretleyin",
    description: "Kabul anındaki hasarları bölge ve önem derecesiyle kayıt altına alın.",
    countLabel: "hasar kaydınız korunuyor",
  },
  vinLookup: {
    ...PRO_DEFAULT,
    name: "VIN ile araç tanıma",
    title: "Aracı VIN üzerinden doğru varyantıyla bulun",
    description: "Şase numarasından marka, model, motor ve katalog eşleşmesini otomatik getirin.",
    countLabel: "araç kaydınız hazır",
  },
  partsCatalog: {
    ...PRO_DEFAULT,
    name: "Parça kataloğu",
    title: "Doğru parçayı katalogdan hızla bulun",
    description: "Araç uyumlu parça sonuçlarını iş emrine ekleyin.",
    countLabel: "iş emri kaydınız hazır",
  },
  bakimxCatalog: {
    ...PRO_DEFAULT,
    name: "BakımX kataloğu",
    title: "BakımX kataloğundan doğrudan sipariş verin",
    description: "Eşleşen ürünleri bulun, iş emrine ekleyin ve sipariş durumunu izleyin.",
    countLabel: "sipariş kaydınız korunuyor",
  },
  getirbakimCatalog: {
    ...PRO_DEFAULT,
    name: "GetirBakım teklifleri",
    title: "Dış tedarik tekliflerini iş emrinde karşılaştırın",
    description: "Uygun teklifleri görün ve satın alma sürecini kayıt altında tutun.",
    countLabel: "dış sipariş kaydınız korunuyor",
  },
  eInvoice: {
    ...PRO_DEFAULT,
    targetTier: "premium",
    name: "e-Fatura",
    title: "e-Fatura işlemlerini BakımX içinde tamamlayın",
    description: "Entegrasyon kullanıma açıldığında Premium paket kapsamında sunulacaktır.",
    countLabel: "iş emri kaydınız hazır",
  },
  multiBranch: {
    ...PRO_DEFAULT,
    targetTier: "premium",
    name: "Çoklu şube",
    title: "Şubelerinizi tek merkezden yönetin",
    description: "Çoklu şube yönetimi ürünleştiğinde Premium paket kapsamında sunulacaktır.",
    countLabel: "kaydınız korunuyor",
  },
  rbac: {
    ...PRO_DEFAULT,
    targetTier: "premium",
    name: "Gelişmiş yetkilendirme",
    title: "Erişimleri ayrıntılı rollerle yönetin",
    description: "Gelişmiş yetkilendirme ürünleştiğinde Premium paket kapsamında sunulacaktır.",
    countLabel: "ekip kaydınız korunuyor",
  },
}
