/**
 * Araç kabulü detayındaki hızlı butonlar (#881): başlığın altında, en sık
 * işleri tek dokunuşla açar ve sayfayı ilgili bölüme kaydırır (#911). Telefonda
 * ustanın uzun sayfada bölümü arayıp düğmeyi bulması gerçekçi değil.
 *
 * Görünürlük, butonun açtığı asıl düğmeyle BİREBİR aynıdır — hızlı buton yeni
 * bir yetki yolu açmaz:
 * - Parça / İşçilik: Kalemler başlığındaki "Kalem ekle" menüsü (`!locked`; grid
 *   araç çubuğu iş emri kabuğunda gizli, #912)
 * - Fotoğraf: Kanıt'taki ekleme akışı (`!orderLocked`; Lite'ta yükseltme alanına gider)
 * - Tahsilat: Ödeme Özeti kartındaki "Tahsilat al" (kasa açık ve tahsilat kilitli
 *   değil; pencere `PaymentHistoryCard`ta durur, #912)
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
