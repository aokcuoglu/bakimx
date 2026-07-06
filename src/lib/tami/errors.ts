/**
 * TAMI hata kodu → Türkçe kullanıcı mesajı haritası.
 * Kaynak: dev.tami.com.tr/hata-kodlari (dokümandan doğrulandı, tam liste).
 */
export const TAMI_ERROR_MESSAGES: Record<string, string> = {
  "30000": "Onaylanmadı. Kartınızın bankası ile iletişime geçin ve farklı bir kartla yeniden deneyin.",
  "30001": "MCC kodu hatalı. Lütfen destek ile iletişime geçin.",
  "30002": "Kart geçersiz. Farklı bir kart ile yeniden deneyin.",
  "30003": "İşlem taksite kapalıdır, tek çekim deneyin.",
  "30004": "Kartın yetkisi yok. Kartınızın bankası ile iletişime geçin ve farklı bir kartla yeniden deneyin.",
  "30005": "Kart e-ticarete kapalı. E-ticarete açarak veya farklı bir kartla yeniden deneyin.",
  "30006": "Tutar bilgisi geçersiz. Lütfen destek ile iletişime geçin.",
  "30007": "Günlük işlem limiti aşıldı. Lütfen destek ile iletişime geçin.",
  "30008": "Yurtdışı ödemeye kapalı kart. Kartınızın bankası ile iletişime geçin ve farklı bir kartla yeniden deneyin.",
  "30009": "Eksik belgeniz mevcut. Lütfen destek ile iletişime geçin.",
  "30010": "Onaylanmadı. E-ticaret işlem limitini arttırarak yeniden deneyin.",
  "30011": "Üye işyeri veya terminal numarası hatalı. Lütfen destek ile iletişime geçin.",
  "30012": "Kart bilgileri hatalı. Bilgileri kontrol ederek veya farklı bir kartla yeniden deneyin.",
  "30013": "Şifre giriş limiti aşıldı. Farklı bir kartla yeniden deneyin.",
  "30014": "İşyeri limiti yetersiz. Lütfen destek ile iletişime geçin.",
  "30015": "Limit / bakiye yetersiz. Limit artırarak veya farklı bir kartla yeniden deneyin.",
  "30016": "Banka tarafında işlem onaylanmadı.",
  "30017": "Şifre hatalı. Girdiğiniz bilgileri kontrol ederek tekrar deneyin.",
  "30018": "Aynı sipariş numarası ile işlem bulunmakta. Lütfen destek ile iletişime geçin.",
  "30019": "Banka beklenen sürede cevap veremedi, bankada anlık bir kesinti yaşanmış olabilir.",
  "30020": "Gün sonu alınmadığından iade yapılamaz, iptal edilebilir. Bilgi için destek ile iletişime geçin.",
  "30021": "İptal edilmeye uygun işlem bulunamadı. İade denenebilir.",
  "30022": "Banka beklenen sürede cevap veremedi, bankada anlık bir kesinti yaşanmış olabilir.",
  "30023": "Günlük iade limitiniz doldu. Lütfen destek ile iletişime geçin.",
  "30024": "Geçerli bir e-posta adresi girerek tekrar deneyin.",
  "30025": "İşyerinin işlem izni bulunmamakta. Lütfen destek ile iletişime geçin.",
  "30026": "Kart sahibi bu işlemi yapamaz. Farklı bir kart ile yeniden deneyin.",
  "30027": "Taksite izin verilmeyen tutar, tek çekim deneyin.",
  "30029": "Doğrulama adımı başarısız olduğundan ödeme banka tarafından reddedildi, yeni bir işlem deneyin.",
  "30030": "Banka tarafında izin verilen maksimum taksit sayısı 6 olabilir. İşlemi tekrar deneyin.",
  "30031": "Banka tarafında işyeri aktif değil. Lütfen destek ile iletişime geçin.",
  "30032": "Banka tarafında izin verilen maksimum taksit sayısı 9 olabilir. İşlemi tekrar deneyin.",
  "30033": "MCC taksite kapalı. Tek çekim deneyin.",
  "30034": "İşyeri tanımlı değil. Lütfen destek ile iletişime geçin.",
  "30035": "İlk işlem tutarından daha yüksek bir tutarla ön otorizasyon kapama yapılamaz. Tekrar deneyin.",
  "30036": "Banka tarafında izin verilen maksimum taksit sayısı 4 olabilir. İşlemi tekrar deneyin.",
  "30037": "Banka tarafında işlem bulunamadı. Lütfen destek ile iletişime geçin.",
  "30038": "İşlemin 3D Secure bilgileri hatalı olduğundan reddedildi. Tekrar deneyin.",
  default: "Ödeme işlemi tamamlanamadı. Lütfen tekrar deneyin veya destek ile iletişime geçin.",
}

export interface TamiErrorInput {
  code: string
  message: string
  correlationId?: string
  userMessage?: string
}

export class TamiError extends Error {
  readonly code: string
  readonly correlationId?: string
  readonly userMessage: string

  constructor(input: TamiErrorInput) {
    super(input.message)
    this.name = "TamiError"
    this.code = input.code
    this.correlationId = input.correlationId
    this.userMessage = input.userMessage ?? TAMI_ERROR_MESSAGES[input.code] ?? TAMI_ERROR_MESSAGES.default
  }
}

/**
 * Loglama için istek gövdesindeki `card` alanını redakte eder. PAN/CVV/holderName hiçbir
 * log satırına düz metin olarak yazılmamalı — bu, client.ts'teki tüm console.error
 * çağrılarından önce zorunlu bir adımdır.
 */
export function sanitizeForLog(reqBody: unknown): unknown {
  if (!reqBody || typeof reqBody !== "object" || Array.isArray(reqBody)) return reqBody

  const clone: Record<string, unknown> = { ...(reqBody as Record<string, unknown>) }
  if ("card" in clone) clone.card = "[redacted]"
  return clone
}
