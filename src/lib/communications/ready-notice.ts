export const READY_NOTICE_TEMPLATE_KEY = "work_order_completed"

type SentReadyNoticeLookup = (where: {
  workshopId: string
  templateKey: string
  entityType: "order"
  entityId: string
  status: "sent"
}) => Promise<{ id: string } | null>

/**
 * "Aracınız hazır" bildirimi iş emri başına bir kez gider: teslime hazır →
 * işlemde → teslime hazır döngüsü müşteriye ikinci mesaj göndermez (#960).
 * Yalnız başarıyla gönderilmiş kayıt engeller; "failed"/"skipped" (onay yok,
 * sağlayıcı hatası) yeniden denemeyi kapatmaz.
 */
export async function hasReadyNoticeBeenSent(
  lookup: SentReadyNoticeLookup,
  workshopId: string,
  orderId: string,
): Promise<boolean> {
  const existing = await lookup({
    workshopId,
    templateKey: READY_NOTICE_TEMPLATE_KEY,
    entityType: "order",
    entityId: orderId,
    status: "sent",
  })
  return existing !== null
}
