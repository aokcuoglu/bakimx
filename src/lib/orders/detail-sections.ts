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
  return LEGACY_TAB_SECTIONS.get(value) ?? null
}

/**
 * Bölüme gidildikten sonraki adres: `#bölüm`. `tab` ve `edit` düşer (yeniden
 * yüklemede düzenleme penceresi tekrar açılmasın), `returnTo` gibi diğer
 * parametreler korunur. Yol + sorgu + hash döner (`history.replaceState` için).
 */
export function sectionUrl(href: string, id: OrderSectionId): string {
  const url = new URL(href)
  url.searchParams.delete("tab")
  url.searchParams.delete("edit")
  url.hash = id
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
