/**
 * İletişim kaydı durumlarının tek kaynağı.
 *
 * `CommunicationLog.status` serbest bir `String` (enum değil), dolayısıyla
 * derleyici "yeni bir durum eklendi ama ekranda karşılığı yok" durumunu
 * yakalayamıyor — nitekim `skipped` tam olarak böyle gözden kaçtı: müşteri onay
 * vermediğinde yazılan satırlar ne sayaçlara giriyor ne de filtreleniyordu
 * (issue #246). Liste, sayaçlar ve filtre artık hep bu diziden besleniyor.
 */

export const COMMUNICATION_STATUSES = ["sent", "failed", "pending", "skipped"] as const

export type CommunicationStatus = (typeof COMMUNICATION_STATUSES)[number]

const STATUS_LABELS: Record<CommunicationStatus, string> = {
  sent: "Gönderildi",
  failed: "Başarısız",
  pending: "Bekliyor",
  // Gönderim DENENMEDİ: müşteri o kanala onay vermemiş. Bilinçli bir atlama,
  // sistemde bir arıza değil — bu yüzden "Başarısız" ile aynı dile düşmemeli.
  skipped: "Gönderilmedi",
}

/** Tanınmayan durum ham hâliyle döner (ekran boş kalmasın). */
export function communicationStatusLabel(status: string): string {
  return STATUS_LABELS[status as CommunicationStatus] ?? status
}
