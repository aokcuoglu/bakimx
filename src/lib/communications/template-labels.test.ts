import { expect, test } from "bun:test"
import { communicationTemplateLabel } from "./template-labels"

test("müşteri şablonları Türkçe etikete çevrilir", () => {
  expect(communicationTemplateLabel("appointment_reminder")).toBe("Randevu Hatırlatması")
  expect(communicationTemplateLabel("work_order_completed")).toBe("İş Emri Tamamlandı")
})

test("hesap e-postaları ham anahtar yerine Türkçe görünür (issue #194)", () => {
  expect(communicationTemplateLabel("welcome_trial")).toBe("Hoş Geldiniz")
  expect(communicationTemplateLabel("verify_email")).toBe("E-posta Doğrulama")
  expect(communicationTemplateLabel("password_reset")).toBe("Şifre Sıfırlama")
})

test("dedup soneki taşıyan anahtarlar önekten çözülür, sonek gösterilmez", () => {
  expect(communicationTemplateLabel("payment_receipt:ORD-42")).toBe("Ödeme Makbuzu")
  expect(communicationTemplateLabel("trial_expiry_t3:2026-08-04")).toBe("Deneme Süresi Hatırlatması")
  expect(communicationTemplateLabel("sub_expiry_t7:2026-09-01")).toBe("Abonelik Hatırlatması")
})

test("boş anahtar tire, tanınmayan anahtar ham hâliyle döner", () => {
  expect(communicationTemplateLabel(null)).toBe("-")
  expect(communicationTemplateLabel("")).toBe("-")
  expect(communicationTemplateLabel("brand_new_key")).toBe("brand_new_key")
})
