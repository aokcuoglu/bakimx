import { expect, test } from "bun:test"
import { auditActionLabel, calendarSyncSubjectLabel, communicationActivityStatusLabel, communicationSubjectLabel, reminderJobLabel } from "./activity-labels"

test("iş yeri hareketleri makine anahtarları yerine kullanıcı diliyle görünür", () => {
  expect(auditActionLabel("order_item_added")).toBe("İş emrine kalem eklendi")
  expect(auditActionLabel("unmapped_action")).toBe("Sistem işlemi kaydedildi")
})

test("iletişim, hatırlatma ve takvim kayıtları kurumsal açıklamalara çevrilir", () => {
  expect(communicationSubjectLabel("email", "password_reset")).toBe("E-posta · Şifre Sıfırlama")
  expect(communicationSubjectLabel("email", "new_application_admin")).toBe("E-posta · Yeni İş Yeri Başvurusu")
  expect(communicationSubjectLabel("email", "stuck_txn_alert:txn-1")).toBe("E-posta · Takılı Ödeme İşlemi Uyarısı")
  expect(communicationActivityStatusLabel("sent")).toBe("Gönderildi")
  expect(communicationActivityStatusLabel("success")).toBe("Başarılı")
  expect(reminderJobLabel("maintenance_reminder")).toBe("Bakım hatırlatmaları işlendi")
  expect(calendarSyncSubjectLabel("appointment")).toBe("Randevu takvime aktarıldı")
})
