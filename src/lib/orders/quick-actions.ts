/**
 * Araç kabulü detayındaki hızlı butonlar (#881): başlığın altında, hangi
 * sekmede olunursa olunsun en sık işleri tek dokunuşla açar. Telefonda ustanın
 * sekme değiştirip sayfayı kaydırması gerçekçi değil.
 *
 * Görünürlük, butonun açtığı asıl düğmeyle BİREBİR aynıdır — hızlı buton yeni
 * bir yetki yolu açmaz:
 * - Parça / İşçilik: `PartsLaborGrid` araç çubuğu (`!locked`)
 * - Fotoğraf: Kanıt'taki ekleme akışı (`!orderLocked`; Lite'ta yükseltme alanına gider)
 * - Tahsilat: `PaymentHistoryCard` "Tahsilat Ekle" (kasa açık ve tahsilat kilitli değil)
 */
export type OrderQuickAction = "parca" | "iscilik" | "foto" | "tahsilat"

export function orderQuickActions({
  orderLocked,
  canCashbox,
  collectionsLocked,
}: {
  /** Teslim edilmiş / iptal emir: kalem ve fotoğraf eklenemez. */
  orderLocked: boolean
  /** Planda kasa (tahsilat) özelliği açık mı. */
  canCashbox: boolean
  /** İptal ya da tahsilatı kapanmış emir. */
  collectionsLocked: boolean
}): OrderQuickAction[] {
  const actions: OrderQuickAction[] = []
  if (!orderLocked) actions.push("parca", "iscilik", "foto")
  // Teslimden sonra da tahsilat alınabilir; bu yüzden orderLocked'a bağlı değil.
  if (canCashbox && !collectionsLocked) actions.push("tahsilat")
  return actions
}
