/**
 * Herkese açık demo/arama talebi gövdesinin doğrulaması ve normalizasyonu
 * (`POST /api/demo-request`). İki kaynak var:
 * - `demo_page` (varsayılan): /demo formu — işletme, il ve aylık araç zorunlu.
 * - `landing_callback`: ana sayfadaki "Sizi arayalım" penceresi (#781) — yalnız
 *   ad ve telefon. Eksik alanlar boş dize saklanır; DemoRequest kolonları `String`
 *   olduğu için şema değişmez.
 */
export type DemoRequestSource = "demo_page" | "landing_callback"

export interface DemoRequestBody {
  source?: DemoRequestSource
  name: string
  businessName?: string
  phone: string
  city?: string
  monthlyVehicles?: string
  notes?: string
  attribution?: unknown
  targetingConsent?: boolean
}

export type NormalizedDemoRequest = {
  name: string
  businessName: string
  phone: string
  city: string
  monthlyVehicles: string
  notes: string | null
}

export const LANDING_CALLBACK_NOTE = "Ana sayfa · Sizi arayalım"

const PHONE_PATTERN = /^[0-9+\-\s()]{7,15}$/

const isCallback = (body: DemoRequestBody) => body.source === "landing_callback"
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "")

export function validateDemoRequestBody(body: DemoRequestBody): Record<string, string> {
  const errors: Record<string, string> = {}

  if (text(body.name).length < 2) {
    errors.name = "Ad Soyad en az 2 karakter olmalıdır"
  }
  if (!PHONE_PATTERN.test(text(body.phone))) {
    errors.phone = "Geçerli bir telefon numarası girin"
  }
  if (isCallback(body)) return errors

  if (text(body.businessName).length < 2) {
    errors.businessName = "İşletme adı en az 2 karakter olmalıdır"
  }
  if (text(body.city).length === 0) {
    errors.city = "Şehir seçimi yapın"
  }
  if (text(body.monthlyVehicles).length === 0) {
    errors.monthlyVehicles = "Aylık araç adedi seçin"
  }
  return errors
}

export function normalizeDemoRequestBody(body: DemoRequestBody): NormalizedDemoRequest {
  const notes = text(body.notes)
  return {
    name: text(body.name),
    businessName: text(body.businessName),
    phone: text(body.phone),
    city: text(body.city),
    monthlyVehicles: text(body.monthlyVehicles),
    notes: isCallback(body) ? [LANDING_CALLBACK_NOTE, notes].filter(Boolean).join(" — ") : notes || null,
  }
}
