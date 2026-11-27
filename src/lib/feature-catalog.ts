import type { GatedFeature } from "@/lib/plan"

export type FeatureDefinition = {
  name: string
  title: string
  description: string
  benefits: readonly string[]
  countLabel: string
  /**
   * `package` = Servis Paketi'ne dahil (eski Lite/Başlangıç satırında kilitli
   * olabilir); `addon` = pakete dahil değil, ileride ayrıca satılacak (#782).
   * `ADDON_FEATURES` (plan.ts) ile aynı olmak zorunda — feature-catalog testi bekçidir.
   */
  kind: "package" | "addon"
}

const PRO_DEFAULT = {
  kind: "package" as const,
  benefits: [
    "Daha hızlı ve standart operasyon akışları",
    "Ekip ve müşteri iletişiminde daha az manuel takip",
    "Kayıtlarınızı silmeden kaldığınız yerden devam",
  ],
}

/** Henüz yayında olmayan ek özellik: satın alma kullanıma açılınca gelir. */
const ADDON_SOON_BENEFITS = [
  "Servis Paketi'nin üzerine ayrıca eklenir",
  "Kullanıma açıldığında uygulama içinden satın alınabilir",
  "Kayıtlarınız silinmez, açıldığında kaldığınız yerden devam",
] as const

/** Uygulama içinden satılmayan ama fiyatı belli ek özellik: tek yol iletişimdir. */
const ADDON_CONTACT_BENEFITS = [
  "Servis Paketi'nin üzerine ayrıca eklenir",
  "Uygulama içinden satın alınamaz; bizimle iletişime geçin",
  "Kayıtlarınız silinmez, açıldığında kaldığınız yerden devam",
] as const

const ADDON_DEFAULT = {
  kind: "addon" as const,
  benefits: [
    "Servis Paketi'nin üzerine ayrıca eklenir",
    "Ayarlar → Paketler'den ek özellik olarak satın alınır",
    "Kayıtlarınız silinmez, açıldığında kaldığınız yerden devam",
  ],
}

export const FEATURE_CATALOG: Record<GatedFeature, FeatureDefinition> = {
  quotes: {
    ...PRO_DEFAULT,
    name: "Teklifler",
    title: "Profesyonel tekliflerle onayı hızlandırın",
    description: "Kalemli teklif hazırlayın, müşteriye gönderin ve onaylanan teklifi araç kabulüne dönüştürün.",
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
    description: "Teknisyen hesapları, görev atama ve ekip performansı Servis Paketi'ne dahildir.",
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
    title: "Satın alma sürecini araç kabulüne bağlayın",
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
    countLabel: "araç kabul analiz için hazır",
  },
  reports: {
    ...PRO_DEFAULT,
    name: "Raporlar ve dışa aktarma",
    title: "Yönetim raporlarını birkaç tıkla hazırlayın",
    description: "Araç kabulü, müşteri, tahsilat, parça ve teknisyen raporlarını görüntüleyip dışa aktarın.",
    countLabel: "araç kabul raporlamaya hazır",
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
    ...ADDON_DEFAULT,
    name: "Ruhsat OCR",
    title: "Ruhsat bilgilerini saniyeler içinde aktarın",
    description: "Ruhsat fotoğrafından müşteri ve araç alanlarını otomatik doldurun.",
    countLabel: "araç kaydınız hazır",
  },
  plateScan: {
    ...PRO_DEFAULT,
    name: "Plaka okuma",
    title: "Aracı plakasından saniyeler içinde kabul edin",
    description: "Kamerayla aracın önünü çekin; plaka ve marka araç kabulüne otomatik gelsin.",
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
    ...ADDON_DEFAULT,
    name: "VIN ile araç tanıma",
    title: "Aracı VIN üzerinden doğru varyantıyla bulun",
    description: "Şase numarasından marka, model, motor ve katalog eşleşmesini otomatik getirin.",
    countLabel: "araç kaydınız hazır",
  },
  partsCatalog: {
    ...ADDON_DEFAULT,
    name: "Parça kataloğu",
    title: "Doğru parçayı katalogdan hızla bulun",
    description: "Araç uyumlu parça sonuçlarını araç kabulüne ekleyin.",
    countLabel: "araç kabul kaydınız hazır",
  },
  bakimxCatalog: {
    ...PRO_DEFAULT,
    name: "BakımX kataloğu",
    title: "BakımX kataloğundan doğrudan sipariş verin",
    description: "Eşleşen ürünleri bulun, araç kabulüne ekleyin ve sipariş durumunu izleyin.",
    countLabel: "sipariş kaydınız korunuyor",
  },
  getirbakimCatalog: {
    ...PRO_DEFAULT,
    name: "GetirBakım teklifleri",
    title: "Dış tedarik tekliflerini araç kabulünde karşılaştırın",
    description: "Uygun teklifleri görün ve satın alma sürecini kayıt altında tutun.",
    countLabel: "dış sipariş kaydınız korunuyor",
  },
  eInvoice: {
    ...ADDON_DEFAULT,
    benefits: ADDON_SOON_BENEFITS,
    name: "e-Fatura",
    title: "e-Fatura işlemlerini BakımX içinde tamamlayın",
    description: "Entegrasyon kullanıma açıldığında ek özellik olarak sunulacaktır.",
    countLabel: "araç kabul kaydınız hazır",
  },
  multiBranch: {
    ...ADDON_DEFAULT,
    benefits: ADDON_CONTACT_BENEFITS,
    name: "Çoklu şube",
    title: "Şubelerinizi tek merkezden yönetin",
    description: "Aynı hesapla birden fazla şube oluşturun ve aralarında geçiş yapın.",
    countLabel: "kaydınız korunuyor",
  },
  rbac: {
    ...PRO_DEFAULT,
    name: "Gelişmiş yetkilendirme",
    title: "Erişimleri ayrıntılı rollerle yönetin",
    description: "Yönetici, servis danışmanı ve teknisyen kendi rolünün yetkileriyle çalışır; rol bazlı yetkilendirme Servis Paketi'ne dahildir.",
    countLabel: "ekip kaydınız korunuyor",
  },
}

export type LockedFeatureLabels = {
  /** Dar rozet (kenar çubuğu): "Ek" + ekran okuyucuya `badgeSrSuffix`. */
  badge: string
  badgeSrSuffix: string
  /** Geniş yüzeylerde (arama, oluşturma merkezi) tam rozet metni. */
  label: string
  /** İpucu eki ve kilit ikonunun erişilebilir adı. */
  description: string
}

/**
 * Kilitli özelliğin rozet ve etiket metinleri (#782). Ek özellik pakette
 * yoktur; pakete dahil bir özellik yalnız eski (Lite/Başlangıç) satırında
 * kilitli görünür ve çıkışı Servis Paketi'dir.
 */
export function lockedFeatureLabels(feature: GatedFeature): LockedFeatureLabels {
  return FEATURE_CATALOG[feature].kind === "addon"
    ? { badge: "Ek", badgeSrSuffix: " özellik", label: "Ek özellik", description: "Ek özellik" }
    : { badge: "Pakette", badgeSrSuffix: "", label: "Pakette", description: "Servis Paketi özelliği" }
}

/**
 * Ek özellik için destek hattına giden hazır WhatsApp mesajı. Satın alınabilen
 * ek özelliklerde birincil yol Ayarlar → Paketler'dir (#829); bu mesaj satın
 * alınamayanlar (çoklu şube, yayında olmayanlar) içindir. Sayfa kilidi
 * (`FeatureUpgradeActions`) ve satır içi not (`AddonLockedNote`) aynı cümleyi kullanır.
 */
export function addonContactMessage(feature: GatedFeature): string {
  return `Merhaba, BakımX ${FEATURE_CATALOG[feature].name} ek özelliği hakkında bilgi almak istiyorum.`
}
