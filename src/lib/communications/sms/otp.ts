import { normalizePhone } from "@/lib/format"
import type { CommunicationResult, SMSProvider } from "../types"
import { getSMSProvider } from "."

/**
 * Araç teslim onay kodu (OTP) — SMS (#746).
 *
 * #632'de WhatsApp authentication şablonuna taşınmıştı; WhatsApp Business API
 * kaldırılınca kod yeniden SMS sağlayıcısından gider. Sözleşme aynıdır:
 * numara ve kod biçimi gönderimden ÖNCE doğrulanır, sağlayıcı yanıtı (alıcı,
 * kod ya da kimlik bilgisi içerebilir) hata metnine taşınmaz.
 *
 * `mock` sağlayıcıda gerçek mesaj gitmez; çağıran kodu ekranda demo olarak
 * gösterir (bkz. requestDeliveryOtpAction).
 */
export function isMockSmsOtp(): boolean {
  return (process.env.SMS_PROVIDER || "mock") === "mock"
}

export function deliveryOtpMessage(code: string): string {
  return `BakimX teslim onay kodunuz: ${code}. Kod 10 dakika geçerlidir. Aracınızın teslimini onaylamak için bu kodu servise iletin.`
}

export async function sendSmsOtp(
  to: string,
  code: string,
  provider: SMSProvider = getSMSProvider(),
): Promise<CommunicationResult> {
  const phone = normalizePhone(to)
  if (!/^5\d{9}$/.test(phone) || !/^\d{6}$/.test(code)) {
    return { success: false, error: "Geçersiz telefon numarası veya kod" }
  }
  try {
    const result = await provider.sendSMS(phone, deliveryOtpMessage(code))
    return result.success
      ? { success: true, providerId: result.providerId }
      : { success: false, error: "SMS onay kodu gönderimi reddedildi" }
  } catch {
    return { success: false, error: "SMS onay kodu gönderilemedi" }
  }
}
