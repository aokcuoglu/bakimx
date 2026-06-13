import type { CommunicationResult, SMSProvider } from "../types"

export class NetgsmProvider implements SMSProvider {
  private apiUrl: string
  private usercode: string
  private password: string
  private sender: string

  constructor() {
    this.apiUrl = process.env.NETGSM_API_URL || "https://api.netgsm.com.tr/sms/send/get"
    this.usercode = process.env.NETGSM_USERCODE || ""
    this.password = process.env.NETGSM_PASSWORD || ""
    this.sender = process.env.NETGSM_SENDER || "BAKIMX"

    if (!this.usercode || !this.password) {
      throw new Error("Netgsm yapılandırması eksik. NETGSM_USERCODE ve NETGSM_PASSWORD ortam değişkenlerini ayarlayınız.")
    }
  }

  async sendSMS(to: string, message: string): Promise<CommunicationResult> {
    try {
      const params = new URLSearchParams({
        usercode: this.usercode,
        password: this.password,
        gsmno: to.startsWith("90") ? to : `90${to}`,
        message: message.slice(0, 480),
        msgheader: this.sender,
        filter: "0",
      })

      const response = await fetch(`${this.apiUrl}?${params.toString()}`, {
        method: "GET",
      })

      const body = await response.text()

      if (body.startsWith("00") || body.startsWith("01")) {
        return {
          success: true,
          providerId: body,
        }
      }

      return {
        success: false,
        error: `Netgsm error: ${body}`,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Netgsm SMS gönderim hatası",
      }
    }
  }
}