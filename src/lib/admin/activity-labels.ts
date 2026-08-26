import { communicationStatusLabel } from "@/lib/communications/status-labels"
import { communicationTemplateLabel } from "@/lib/communications/template-labels"

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  feature_override_set: "Özellik erişimi güncellendi",
  password_reset_sent: "Şifre sıfırlama bağlantısı gönderildi",
  member_password_reset: "Ekip üyesine şifre sıfırlama bağlantısı gönderildi",
  order_item_added: "İş emrine kalem eklendi",
  purchase_recorded: "Satın alma kaydedildi",
  ocr_capture: "Belge taraması işlendi",
  order_status_changed_to_in_progress: "İş emri işleme alındı",
  technician_assigned: "Teknisyen atandı",
  labor_item_deleted: "İşçilik kalemi silindi",
  calendar_synced: "Takvim kaydı eşitlendi",
  appointment_created: "Randevu oluşturuldu",
  appointment_converted_to_work_order: "Randevu iş emrine dönüştürüldü",
  customer_created: "Müşteri oluşturuldu",
  customer_created_via_ocr: "Müşteri belgeden oluşturuldu",
  customer_updated: "Müşteri bilgileri güncellendi",
  customer_deleted: "Müşteri silindi",
  vehicle_created: "Araç oluşturuldu",
  vehicle_updated: "Araç bilgileri güncellendi",
  vehicle_deleted: "Araç silindi",
  vehicle_owner_changed: "Araç sahibi güncellendi",
  vehicle_catalog_linked: "Araç katalogla eşleştirildi",
  vehicle_vin_confirmed: "Şasi numarası doğrulandı",
  intake_created: "Araç kabulü oluşturuldu",
  service_order_created: "İş emri oluşturuldu",
  service_order_created_from_appointment: "İş emri randevudan oluşturuldu",
  service_order_created_from_quote: "İş emri tekliften oluşturuldu",
  quote_created: "Teklif oluşturuldu",
  quote_converted_to_work_order: "Teklif iş emrine dönüştürüldü",
  order_meta_updated: "İş emri bilgileri güncellendi",
  order_status_changed_to_delivered: "İş emri teslim edildi",
  technician_unassigned: "Teknisyen ataması kaldırıldı",
  technician_created: "Teknisyen oluşturuldu",
  labor_item_created: "İşçilik kalemi eklendi",
  labor_item_updated: "İşçilik kalemi güncellendi",
  labor_item_deactivated: "İşçilik kalemi pasifleştirildi",
  part_created: "Parça oluşturuldu",
  part_updated: "Parça bilgileri güncellendi",
  part_deleted: "Parça silindi",
  part_deactivated: "Parça pasifleştirildi",
  part_reactivated: "Parça yeniden etkinleştirildi",
  parts_requested: "Parça talebi oluşturuldu",
  checklist_item_added: "Kontrol listesine madde eklendi",
  damage_mark_added: "Hasar işareti eklendi",
  damage_mark_removed: "Hasar işareti kaldırıldı",
  photo_uploaded: "Fotoğraf eklendi",
  photo_upload_error: "Fotoğraf yüklenemedi",
  delivery_otp_requested: "Teslimat doğrulama kodu istendi",
  delivery_otp_verified: "Teslimat doğrulama kodu doğrulandı",
  passport_token_created: "Araç pasaportu bağlantısı oluşturuldu",
  passport_token_updated: "Araç pasaportu bağlantısı güncellendi",
  passport_token_deleted: "Araç pasaportu bağlantısı kaldırıldı",
  share_link_generated: "Paylaşım bağlantısı oluşturuldu",
  password_changed: "Şifre değiştirildi",
  profile_updated: "Profil bilgileri güncellendi",
  update_business_profile: "İş yeri bilgileri güncellendi",
  update_branding: "Marka ayarları güncellendi",
  update_communication_settings: "İletişim ayarları güncellendi",
  update_working_hours: "Çalışma saatleri güncellendi",
  update_appointment_rules: "Randevu kuralları güncellendi",
  update_pdf_templates: "PDF şablonları güncellendi",
}

const REMINDER_JOB_LABELS: Record<string, string> = {
  appointment_reminder: "Randevu hatırlatmaları işlendi",
  maintenance_reminder: "Bakım hatırlatmaları işlendi",
  delivery_reminder: "Teslimat hatırlatmaları işlendi",
}

const CALENDAR_EVENT_LABELS: Record<string, string> = {
  appointment: "Randevu takvime aktarıldı",
  delivery: "Teslimat takvime aktarıldı",
  maintenance_reminder: "Bakım hatırlatması takvime aktarıldı",
}

const ACTIVITY_STATUS_LABELS: Record<string, string> = {
  success: "Başarılı",
  partial: "Kısmen tamamlandı",
  failed: "Başarısız",
  pending: "Bekliyor",
}

export const AUDIT_ACTION_OPTIONS = Object.entries(AUDIT_ACTION_LABELS)
  .map(([value, label]) => ({ value, label }))
  .sort((a, b) => a.label.localeCompare(b.label, "tr"))

export const ACTIVITY_STATUS_OPTIONS = ["sent", "success", "partial", "failed", "pending", "skipped"]
  .map((value) => ({ value, label: communicationActivityStatusLabel(value) }))

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? "Sistem işlemi kaydedildi"
}

export function communicationSubjectLabel(type: string, templateKey: string | null): string {
  const channel = { email: "E-posta", sms: "SMS", whatsapp: "WhatsApp" }[type] ?? "İletişim"
  return `${channel} · ${communicationTemplateLabel(templateKey)}`
}

export function communicationActivityStatusLabel(status: string): string {
  return communicationStatusLabel(status) === status ? (ACTIVITY_STATUS_LABELS[status] ?? "Durum güncellendi") : communicationStatusLabel(status)
}

export function reminderJobLabel(jobType: string): string {
  return REMINDER_JOB_LABELS[jobType] ?? "Hatırlatma işlemi tamamlandı"
}

export function calendarSyncSubjectLabel(eventType: string | null): string {
  return CALENDAR_EVENT_LABELS[eventType ?? ""] ?? "Takvim eşitlemesi tamamlandı"
}
