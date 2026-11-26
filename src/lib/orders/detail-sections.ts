/**
 * Araç kabulü detayının bölümleri (#911). Sayfa sekmeli değil, tek kaydırmalı:
 * telefonda yapışkan bölüm çipleri bu listeden çizilir, eski `?tab=`
 * bağlantıları da buradaki eşlemeyle ilgili bölüme kaydırır.
 *
 * Saf modül (DOM yok): sıralama ve eşleme birim testinde sabitlenir.
 */
export const ORDER_SECTIONS = [
  { id: "ozet", label: "Özet" },
  { id: "kalemler", label: "Kalemler" },
  { id: "kanit", label: "Kanıt" },
  { id: "odeme", label: "Ödeme" },
  { id: "teknisyen", label: "Teknisyen" },
  { id: "gecmis", label: "Geçmiş" },
] as const

export type OrderSectionId = (typeof ORDER_SECTIONS)[number]["id"]

/** DOM'dan okunan değer (`data-section`, `location.hash`) gerçekten bir bölüm mü. */
export function isOrderSectionId(value: string | null | undefined): value is OrderSectionId {
  return ORDER_SECTIONS.some((section) => section.id === value)
}

/**
 * `location.hash`in son parçası. Önbellekteki bir yolculuk (önce `#kalemler`,
 * sonra başka sayfa, sonra `/orders/<id>#odeme`) Next'te adresi `…#kalemler#odeme`
 * yapar (#996): düz `slice(1)` "kalemler#odeme" okur, bölüm bulunamaz ve sayfa
 * en üstte kalır. Tarayıcının kendi çapa çözümü de son parçayı kullanır.
 */
export function lastHashSegment(hash: string): string {
  return hash.slice(hash.lastIndexOf("#") + 1)
}

// Eski sekme anahtarı → bölüm. `ozet` bilinçli olarak yok: Özet sayfanın başı,
// açılışta kaydırılacak bir yer yok (liste "Düzenle"nin `?edit=1`i de böyle kalır).
const LEGACY_TAB_SECTIONS = new Map<string, OrderSectionId>([
  ["parca", "kalemler"],
  ["tahsilat", "odeme"],
  ["kanit", "kanit"],
  ["teknisyen", "teknisyen"],
  ["gecmis", "gecmis"],
])

/**
 * Liste, bildirim ve uyarı bağlantılarındaki `?tab=` değerini bölüme çevirir.
 * `null` → kaydırma yok (Özet, bilinmeyen değer, parametre yok).
 */
export function sectionForLegacyTab(value: string | null | undefined): OrderSectionId | null {
  if (!value) return null
  const legacy = LEGACY_TAB_SECTIONS.get(value)
  if (legacy) return legacy
  // Bölüm kimliğiyle yazılan bağlantı (`?tab=odeme`, #996) da aynı bölüme gider.
  return value !== "ozet" && isOrderSectionId(value) ? value : null
}

/**
 * Bölüme gidildikten sonraki adres: `#bölüm`; `drop` verilen parametreler düşer,
 * diğerleri (`returnTo`…) korunur. Yol + sorgu + hash döner.
 *
 * Yalnız hash değişiyorsa `history.replaceState(null, …)` yeter. Sorgu
 * değişiyorsa (`?tab=` / `?edit=` düşüyorsa) `router.replace(…, { scroll: false })`
 * gerekir: sayfa `searchParams` aldığı için sorgu sayfa segmentinin anahtarıdır;
 * yalnız tarayıcı adresi değişirse sonraki `router.refresh()` ağaç uyuşmazlığına
 * düşüp sayfayı hash'e ya da en üste kaydırıyordu (#911 ölçümü).
 */
export function sectionUrl(href: string, id: OrderSectionId, drop: readonly string[] = []): string {
  const url = new URL(href)
  for (const name of drop) url.searchParams.delete(name)
  url.hash = id
  return `${url.pathname}${url.search}${url.hash}`
}

/**
 * Adresten parametreleri düşürür (hash korunur). Hiçbiri yoksa null — adres
 * değişmez, gezinme yapılmaz. Liste "Düzenle"nin `?edit=1`i ve eski `?tab=`
 * yalnız ilk açılış içindir: yeniden yüklemede pencere tekrar açılmasın.
 */
export function urlWithout(href: string, names: readonly string[]): string | null {
  const url = new URL(href)
  if (!names.some((name) => url.searchParams.has(name))) return null
  for (const name of names) url.searchParams.delete(name)
  return `${url.pathname}${url.search}${url.hash}`
}

export type SectionTop = { id: OrderSectionId; top: number }

/**
 * Etkin bölüm: üst kenarı okuma çizgisini (`offset`, yapışkan bar + çip
 * şeridi) geçmiş bölümlerin en altta olanı. Hiçbiri geçmediyse görsel olarak
 * ilk bölüm. Sayfa sonundayken (`atEnd`) kısa son bölüm çizgiye hiç
 * ulaşamayacağı için en alttaki bölüm seçilir.
 *
 * `tops` sırası önemsizdir: telefonda bloklar CSS `order` ile dizildiği için
 * DOM sırası görsel sırayla aynı değildir; karar yalnız konumdan verilir.
 */
export function pickActiveSection(
  tops: readonly SectionTop[],
  offset: number,
  atEnd = false,
): OrderSectionId {
  if (tops.length === 0) return ORDER_SECTIONS[0].id
  const byTop = [...tops].sort((a, b) => a.top - b.top)
  if (atEnd) return byTop[byTop.length - 1].id
  const line = offset + 8
  let active = byTop[0].id
  for (const section of byTop) {
    if (section.top <= line) active = section.id
  }
  return active
}
