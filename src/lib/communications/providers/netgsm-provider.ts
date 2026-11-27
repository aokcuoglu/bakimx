import { normalizePhone } from "@/lib/format"
import type { CommunicationResult, SMSProvider } from "../types"

const DEFAULT_API_URL = "https://api.netgsm.com.tr/sms/rest/v2/send"
const REQUEST_TIMEOUT_MS = 10_000
/**
 * Uzun mesaj üst sınırı — yaklaşık değer (TR karakter kümesinde birleştirilmiş
 * SMS'in pratik tavanı). Aşan mesaj kırpılmaz, reddedilir.
 */
export const NETGSM_MAX_MESSAGE_LENGTH = 912

/**
 * Hata mesajları kasıtlı olarak sabittir: numara, mesaj metni, kimlik bilgisi
 * ya da ham yanıt asla taşınmaz (`sms/otp.ts` sözleşmesi).
 */
const ERROR_MESSAGES: Record<string, string> = {
  "20": "Netgsm: mesaj metni boş, hatalı ya da çok uzun (kod 20)",
  "30": "Netgsm: kimlik doğrulama, API izni veya IP kısıtı hatası (kod 30)",
  "40": "Netgsm: gönderici başlığı hesapta tanımlı değil (kod 40)",
  "50": "Netgsm: İYS kontrolü başarısız (kod 50)",
  "51": "Netgsm: İYS marka bilgisi bulunamadı (kod 51)",
  "70": "Netgsm: hatalı istek parametresi (kod 70)",
  "80": "Netgsm: gönderim sınırı aşıldı (kod 80)",
  "85": "Netgsm: mükerrer gönderim sınırı aşıldı (kod 85)",
}

/** Netgsm'in beklediği 10 haneli `5xxxxxxxxx`; geçersizse `null`. */
export function toNetgsmNumber(input: string): string | null {
  const phone = normalizePhone(input)
  return /^5\d{9}$/.test(phone) ? phone : null
}

export function netgsmErrorMessage(code: string | undefined): string {
  if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code]
  return code && /^\d{1,4}$/.test(code)
    ? `Netgsm: SMS gönderilemedi (kod ${code})`
    : "Netgsm: SMS gönderilemedi"
}

export class NetgsmProvider implements SMSProvider {
  private apiUrl: string
  private usercode: string
  private password: string
  private sender: string

  constructor() {
    this.apiUrl = process.env.NETGSM_API_URL || DEFAULT_API_URL
    this.usercode = process.env.NETGSM_USERCODE || ""
    this.password = process.env.NETGSM_PASSWORD || ""
    this.sender = process.env.NETGSM_SENDER || "BAKIMX"

    if (!this.usercode || !this.password) {
      throw new Error("Netgsm yapılandırması eksik. NETGSM_USERCODE ve NETGSM_PASSWORD ortam değişkenlerini ayarlayınız.")
    }
  }

  async sendSMS(to: string, message: string): Promise<CommunicationResult> {
    const no = toNetgsmNumber(to)
    if (!no) return { success: false, error: "Geçersiz telefon numarası" }
    if (!message.trim() || message.length > NETGSM_MAX_MESSAGE_LENGTH) {
      return { success: false, error: "Netgsm: mesaj metni boş veya çok uzun" }
    }

    try {
      const auth = Buffer.from(`${this.usercode}:${this.password}`).toString("base64")
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          msgheader: this.sender,
          encoding: "TR",
          iysfilter: "0",
          messages: [{ msg: message, no }],
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })

      const data = await response.json().then(
        (body: unknown) => (body && typeof body === "object" ? (body as { code?: unknown; jobid?: unknown }) : null),
        (error: unknown) => {
          // Gövde okunurken zaman aşımı "beklenmeyen yanıt" diye yutulmasın.
          if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) throw error
          return null
        },
      )

      const code = data && data.code != null ? String(data.code) : undefined
      if (response.ok && code === "00") {
        return {
          success: true,
          providerId: data?.jobid != null ? String(data.jobid) : undefined,
        }
      }
      if (code) return { success: false, error: netgsmErrorMessage(code) }
      return {
        success: false,
        error: response.ok
          ? "Netgsm: beklenmeyen yanıt alındı"
          : `Netgsm: sunucu hatası (HTTP ${response.status})`,
      }
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
      return {
        success: false,
        error: timedOut ? "Netgsm: istek zaman aşımına uğradı" : "Netgsm: SMS servisine ulaşılamadı",
      }
    }
  }
}
