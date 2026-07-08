import { randomBytes } from "crypto"

/**
 * Kuruş (minor units) → TAMI'nin beklediği lira tutarı (major, 2 ondalık).
 * TAMI istek tipi `amount: number` ister; callback tarafında txnAmount bu
 * sayının `.toFixed(2)` hâlidir (bkz. mock/gerçek bankanın "7499.00" formatı).
 * Math.round ile önce tamsayıya sabitlenip 100'e bölünür (float sapması yok).
 * Örn: 749900 → 7499 (toFixed(2) → "7499.00"), 749950 → 7499.5 ("7499.50").
 */
export function minorToTamiAmount(amountMinor: number): number {
  return Math.round(amountMinor) / 100
}

/**
 * Callback txnAmount ("1" | "1.00" | "1299.5") ↔ kuruş eşitliği; parse edilemeyen → false.
 * Canlı yakalanan callback wire'ı ondalıksız/serbest biçimli sayı string'i gönderir
 * ("1", "1299.5") — sabit 2-ondalık string karşılaştırması YERİNE sayısal
 * karşılaştırma kullanılır (bkz. callback-capture.json).
 */
export function tamiAmountEqualsMinor(wire: string, amountMinor: number): boolean {
  const n = Number(wire)
  if (!Number.isFinite(n) || wire.trim() === "") return false
  return Math.round(n * 100) === Math.round(amountMinor)
}

/**
 * TAMI'ye giden `orderId` (= PaymentTransaction.providerOrderId). Deneme başına
 * BENZERSİZ olmalı (aynı BillingOrder retry alabilir) ve 2-36 karakter sığmalı.
 * Sipariş referansı + 12 hex rastgele: `BX-XXXXXX-<12 hex>` (~22 kar.). cuid'in
 * ilk N karakteri gibi çakışma riskli kısaltmalar KULLANILMAZ — tam entropi.
 */
export function generateProviderOrderId(reference: string): string {
  const suffix = randomBytes(6).toString("hex") // 12 hex karakter
  return `${reference}-${suffix}`
}

/**
 * İstemci IP'sini header'lardan çözer — TAMI buyer.ipAddress için. x-forwarded-for
 * "a, b, c" zincirinin İLK (istemci) IP'sini, yoksa x-real-ip'yi, hiçbiri yoksa
 * "0.0.0.0" döndürür (TAMI geçerli bir IP bekler; "unknown" göndermeyiz).
 */
export function resolveClientIp(forwardedFor: string | null, realIp: string | null): string {
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim()
    if (first) return first
  }
  const real = realIp?.trim()
  return real || "0.0.0.0"
}

/**
 * Tek parça isim → {name, surName}. TAMI buyer name/surName ayrı ister; snapshot'ta
 * ad/soyad ayrımı yoksa ilk kelime ad, kalanı soyad. Tek kelimeyse soyad = ad
 * (TAMI boş soyadı reddedebilir).
 */
export function splitName(full: string): { name: string; surName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { name: "-", surName: "-" }
  const name = parts[0]
  const surName = parts.slice(1).join(" ") || name
  return { name, surName }
}

/**
 * TAMI maskedNumber'dan GERÇEKTEN açık olan son haneleri döndürür. TAMI maskesi
 * `<BIN haneleri>****<son haneler>` biçimindedir (ör. "54407806****11"); yıldızları
 * silip `.slice(-4)` almak BIN hanelerini karıştırıp YANLIŞ bir "son 4" üretir
 * ("54407806****11" → "5440780611" → "0611" ≠ kartın gerçek son haneleri). Doğru
 * davranış: maskeden SONRAKİ (en sondaki) rakam grubunu al — TAMI'nin açtığı gerçek
 * son haneler (burada "11"). Rakamla bitmeyen/boş maske → null.
 */
export function revealedCardSuffix(maskedPan: string | null | undefined): string | null {
  if (!maskedPan) return null
  const m = maskedPan.match(/\d+$/)
  return m ? m[0] : null
}

/**
 * Luhn (mod-10) kontrolü — kart numarası server-side doğrulaması için. Yalnız
 * rakamlar; boşluk/tire yoksa çağıran temizler. Boş/rakam-dışı → false.
 */
export function luhnCheck(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "")
  if (digits.length < 12) return false
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    double = !double
  }
  return sum % 10 === 0
}
