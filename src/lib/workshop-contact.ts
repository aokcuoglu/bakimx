import { formatPhoneTR, normalizePhone } from "@/lib/format"
import type { BrandIconKey } from "@/lib/brand-icons"

/**
 * Atölyenin müşteriye gösterdiği pazarlama / iletişim bilgileri (#173).
 *
 * Bu alanlar `WorkshopSettings` üzerinde nullable kolonlar olarak durur ve
 * müşteriye giden her yüzeyin (paylaşım sayfası, araç pasaportu, PDF çıktıları,
 * makbuz) alt bilgisinde aynı sırayla gösterilir.
 *
 * `publicWhatsappNumber`, `WorkshopSettings.whatsappPhoneNumber` ile KARIŞTIRILMAMALI:
 * o alan WhatsApp sağlayıcısının gönderim numarasıdır. Aynı kolonu paylaşmak,
 * sağlayıcı numarası değiştiği anda müşteriye yanlış numara basar.
 */
export type WorkshopPublicContact = {
  publicWhatsappNumber?: string | null
  secondaryPhone?: string | null
  faxNumber?: string | null
  instagramUrl?: string | null
  facebookUrl?: string | null
  xUrl?: string | null
  tiktokUrl?: string | null
  youtubeUrl?: string | null
  linkedinUrl?: string | null
}

/** Tek bir alt bilgi satırı: etiket + gösterilecek metin + (varsa) bağlantı. */
export type WorkshopContactEntry = {
  key: string
  label: string
  value: string
  href: string | null
  /**
   * Sosyal satırlarda gösterilecek marka ikonu. Eşleme burada durur ki React
   * yüzeyleri ile ham HTML (PDF/makbuz) yüzeyleri aynı ikonu göstersin.
   * Numara satırlarında yoktur — telefon/faks bir marka değil.
   */
  icon?: BrandIconKey
}

/** Numara alanları — form ve sunucu tarafı aynı listeyi kullanır. */
export const WORKSHOP_CONTACT_NUMBER_FIELDS = [
  "publicWhatsappNumber",
  "secondaryPhone",
  "faxNumber",
] as const

/** Sosyal medya alanları — gösterim sırası da budur. */
export const WORKSHOP_SOCIAL_FIELDS = [
  "instagramUrl",
  "facebookUrl",
  "xUrl",
  "tiktokUrl",
  "youtubeUrl",
  "linkedinUrl",
] as const

export type WorkshopContactNumberField = (typeof WORKSHOP_CONTACT_NUMBER_FIELDS)[number]
export type WorkshopSocialField = (typeof WORKSHOP_SOCIAL_FIELDS)[number]

/**
 * `WorkshopSettings` sorgularına eklenen ortak `select` parçası — müşteriye açık
 * her yüzey aynı alan setini çeker, biri güncellenip diğeri unutulamaz.
 */
export const WORKSHOP_PUBLIC_CONTACT_SELECT = {
  publicWhatsappNumber: true,
  secondaryPhone: true,
  faxNumber: true,
  instagramUrl: true,
  facebookUrl: true,
  xUrl: true,
  tiktokUrl: true,
  youtubeUrl: true,
  linkedinUrl: true,
} as const

/**
 * Ayar kaydından yalnızca müşteriye açık iletişim alanlarını ayıklar. İstemciye
 * serileştirilen nesneye ayarların geri kalanının (sağlayıcı numarası, API
 * anahtarı vb.) sızmasını engeller.
 */
export function pickWorkshopPublicContact(
  settings: WorkshopPublicContact | null | undefined
): WorkshopPublicContact | null {
  if (!settings) return null
  return {
    publicWhatsappNumber: settings.publicWhatsappNumber ?? null,
    secondaryPhone: settings.secondaryPhone ?? null,
    faxNumber: settings.faxNumber ?? null,
    instagramUrl: settings.instagramUrl ?? null,
    facebookUrl: settings.facebookUrl ?? null,
    xUrl: settings.xUrl ?? null,
    tiktokUrl: settings.tiktokUrl ?? null,
    youtubeUrl: settings.youtubeUrl ?? null,
    linkedinUrl: settings.linkedinUrl ?? null,
  }
}

const SOCIAL_LABELS: Record<WorkshopSocialField, string> = {
  instagramUrl: "Instagram",
  facebookUrl: "Facebook",
  xUrl: "X",
  tiktokUrl: "TikTok",
  youtubeUrl: "YouTube",
  linkedinUrl: "LinkedIn",
}

/** Alan -> marka ikonu. Tek eşleme; React ve PDF yüzeyleri buradan okur. */
const SOCIAL_ICONS: Record<WorkshopSocialField, BrandIconKey> = {
  instagramUrl: "instagram",
  facebookUrl: "facebook",
  xUrl: "x",
  tiktokUrl: "tiktok",
  youtubeUrl: "youtube",
  linkedinUrl: "linkedin",
}

const NUMBER_LABELS: Record<WorkshopContactNumberField, string> = {
  publicWhatsappNumber: "WhatsApp",
  secondaryPhone: "Telefon 2",
  faxNumber: "Faks",
}

/**
 * Kullanıcının yazdığı sosyal medya adresini kanonik bir http(s) URL'ine çevirir.
 *
 * - Şema yazılmadıysa `https://` eklenir ("instagram.com/atolye" geçerlidir).
 * - `http`/`https` dışındaki her şema reddedilir — bu değer `href` içine
 *   basıldığı için `javascript:` gibi girdiler buradan geçmemeli.
 * - Nokta içermeyen bir host (ör. "localhost", "atolye") reddedilir.
 *
 * Geçersiz veya boş girdi için `null` döner.
 */
export function normalizeSocialUrl(input: string | null | undefined): string | null {
  const raw = (input ?? "").trim()
  if (!raw) return null

  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`

  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return null
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(url.hostname)) return null

  return url.toString()
}

/**
 * Telefon / faks / WhatsApp alanlarını uygulamanın geri kalanıyla aynı kanonik
 * 10 haneli forma indirger ("0212 111 22 33" -> "2121112233"). Eksik veya fazla
 * haneli girdi `null` döner, böylece yarım numara kaydedilmez.
 */
export function normalizeContactNumber(input: string | null | undefined): string | null {
  const digits = normalizePhone((input ?? "").trim())
  return digits.length === 10 ? digits : null
}

/** Sosyal bağlantıyı okunur kısa metne çevirir: "https://www.instagram.com/x/" -> "instagram.com/x". */
function socialDisplayValue(url: string): string {
  return url
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "")
}

/**
 * Dolu olan alanları gösterime hazır satırlara çevirir. Boş, geçersiz veya
 * yarım bırakılmış her alan tamamen atlanır — çağıran taraf boş etiket, boş
 * ikon veya boş satır basmaz.
 */
export function buildWorkshopContactEntries(contact: WorkshopPublicContact | null | undefined): {
  channels: WorkshopContactEntry[]
  socials: WorkshopContactEntry[]
} {
  if (!contact) return { channels: [], socials: [] }

  const channels: WorkshopContactEntry[] = []
  for (const key of WORKSHOP_CONTACT_NUMBER_FIELDS) {
    const digits = normalizeContactNumber(contact[key])
    if (!digits) continue
    channels.push({
      key,
      label: NUMBER_LABELS[key],
      value: formatPhoneTR(digits),
      href:
        key === "publicWhatsappNumber"
          ? `https://wa.me/90${digits}`
          : key === "secondaryPhone"
            ? `tel:+90${digits}`
            : null,
    })
  }

  const socials: WorkshopContactEntry[] = []
  for (const key of WORKSHOP_SOCIAL_FIELDS) {
    const url = normalizeSocialUrl(contact[key])
    if (!url) continue
    socials.push({
      key,
      label: SOCIAL_LABELS[key],
      value: socialDisplayValue(url),
      href: url,
      icon: SOCIAL_ICONS[key],
    })
  }

  return { channels, socials }
}

/** Hiçbir alan dolu değilse bölüm hiç basılmaz. */
export function hasWorkshopContactInfo(contact: WorkshopPublicContact | null | undefined): boolean {
  const { channels, socials } = buildWorkshopContactEntries(contact)
  return channels.length > 0 || socials.length > 0
}
