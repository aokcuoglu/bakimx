/**
 * İletişim kaydı şablon anahtarlarının Türkçe karşılıkları.
 *
 * Kayıtta saklanan anahtar makine tarafı (`welcome_trial`, `verify_email`), ama
 * İletişim Kayıtları ekranında ham hâliyle görününce kullanıcı listeyi
 * okuyamıyordu (issue #194). Bazı anahtarlar dedup için sonek taşır
 * (`payment_receipt:<ref>`, `trial_expiry_t7:<tarih>`) — bunlar önek eşleşmesiyle
 * çözülür, sonek kullanıcıya gösterilmez.
 */

/** Sonek taşımayan, birebir eşleşen anahtarlar. */
const EXACT_LABELS: Record<string, string> = {
  // Müşteriye giden bildirimler
  appointment_created: "Randevu Oluşturuldu",
  appointment_reminder: "Randevu Hatırlatması",
  intake_approval: "Araç Kabul Onayı",
  quote_ready: "Teklif Hazır",
  work_order_completed: "İş Emri Tamamlandı",
  maintenance_reminder: "Bakım Hatırlatması",
  payment_reminder: "Ödeme Hatırlatması",
  vehicle_passport_share: "Araç Pasaportu Paylaşımı",
  // Atölyenin kendi hesabına giden sistem e-postaları
  verify_email: "E-posta Doğrulama",
  welcome_trial: "Hoş Geldiniz",
  password_reset: "Şifre Sıfırlama",
  workshop_approved: "Hesabınız Onaylandı",
  workshop_rejected: "Başvuru Sonucu",
  test: "Test Gönderimi",
}

/** `<önek>:<dedup soneki>` biçimindeki anahtarlar. Önek sırası önemli değil —
 *  hepsi ayrık. */
const PREFIX_LABELS: [prefix: string, label: string][] = [
  ["payment_receipt", "Ödeme Makbuzu"],
  ["trial_expiry_t", "Deneme Süresi Hatırlatması"],
  ["sub_expiry_t", "Abonelik Hatırlatması"],
]

/**
 * Bir şablon anahtarını kullanıcıya gösterilecek etikete çevirir. Tanınmayan
 * anahtar ham hâliyle döner (yeni bir şablon eklendiğinde ekran boş kalmasın);
 * anahtar yoksa "-" döner.
 */
export function communicationTemplateLabel(templateKey: string | null | undefined): string {
  if (!templateKey) return "-"

  const exact = EXACT_LABELS[templateKey]
  if (exact) return exact

  for (const [prefix, label] of PREFIX_LABELS) {
    if (templateKey.startsWith(prefix)) return label
  }

  return templateKey
}
