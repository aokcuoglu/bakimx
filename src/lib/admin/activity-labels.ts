import { communicationStatusLabel } from "@/lib/communications/status-labels"
import { communicationTemplateLabel } from "@/lib/communications/template-labels"

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  admin_workshop_approved: "İş yeri onaylandı",
  admin_workshop_rejected: "İş yeri reddedildi",
  admin_plan_activated: "Plan etkinleştirildi",
  admin_extra_seats_set: "Ek koltuk ayarlandı",
  admin_support_request_status: "Destek talebi durumu güncellendi",
  admin_support_request_linked: "Destek talebi iş yerine bağlandı",
  admin_support_request_assigned: "Destek talebi sorumlusu güncellendi",
  admin_support_request_note: "Destek talebi iç notu güncellendi",
  billing_order_confirmed: "Havale teyit edildi",
  billing_order_cancelled: "Sipariş iptal edildi",
  payment_activation_retried: "Ödeme aktivasyonu yeniden denendi",
  payment_activation_retry_blocked: "Ödeme aktivasyonu yeniden denemesi engellendi",
  workshop_acquisition_updated: "Edinim kaynağı güncellendi",
  workshop_bakimx_discount_updated: "BakımX iskontosu güncellendi",
  workshop_user_role_updated: "Kullanıcı rolü güncellendi",
  workshop_user_active_changed: "Kullanıcı durumu güncellendi",
  platform_admin_added: "Platform yöneticisi eklendi",
  platform_admin_role_changed: "Platform yöneticisi rolü güncellendi",
  platform_admin_disabled: "Platform yöneticisi devre dışı bırakıldı",
  platform_admin_enabled: "Platform yöneticisi etkinleştirildi",
  platform_admin_sessions_revoked: "Platform yöneticisi oturumları sonlandırıldı",
  platform_admin_break_glass_login: "Acil yönetici girişi yapıldı",
  impersonation_started: "Müşteri görünümü oturumu başlatıldı",
  impersonation_ended: "Müşteri görünümü oturumu sonlandırıldı",
  impersonation_revoked: "Müşteri görünümü oturumu iptal edildi",
  password_reset_sent: "Şifre sıfırlama bağlantısı gönderildi",
  email_verified_trial_started: "E-posta doğrulandı ve deneme başlatıldı",
  member_created_local: "Ekip üyesi oluşturuldu",
  member_password_reset: "Ekip üyesine şifre sıfırlama bağlantısı gönderildi",
  order_item_added: "İş emrine kalem eklendi",
  order_item_updated: "İş emri kalemi güncellendi",
  order_item_removed: "İş emri kalemi kaldırıldı",
  order_item_completed: "İş emri kalemi tamamlandı",
  order_item_uncompleted: "İş emri kalemi yeniden açıldı",
  purchase_recorded: "Satın alma kaydedildi",
  purchase_updated: "Satın alma güncellendi",
  collection_created: "Tahsilat kaydedildi",
  payment_status_changed_to_paid: "Ödeme durumu ödendi olarak güncellendi",
  ocr_capture: "Belge taraması işlendi",
  order_status_changed_to_draft: "İş emri taslağa alındı",
  order_status_changed_to_in_progress: "İş emri işleme alındı",
  order_status_changed_to_waiting_parts: "İş emri parça beklemeye alındı",
  order_status_changed_to_ready_for_delivery: "İş emri teslime hazırlandı",
  order_status_changed_to_cancelled: "İş emri iptal edildi",
  order_arrival_reason_set: "Araç geliş nedeni güncellendi",
  order_invoice_updated: "İş emri faturası güncellendi",
  technician_assigned: "Teknisyen atandı",
  labor_item_deleted: "İşçilik kalemi silindi",
  labor_presets_imported: "Hazır işçilikler içe aktarıldı",
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
  parts_request_converted: "Parça talebi satın almaya dönüştürüldü",
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
  created: "Kayıt oluşturuldu",
  completed: "İşlem tamamlandı",
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
