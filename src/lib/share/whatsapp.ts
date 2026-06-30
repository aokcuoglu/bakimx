import { formatKurus } from "@/lib/money"

export function generateWhatsAppShareText(options: {
  publicLink: string
  workshopName?: string
  plate?: string
  statusLabel?: string
  totalAmount?: number | null // kuruş
}): string {
  const { publicLink, workshopName, plate, statusLabel, totalAmount } = options

  const lines: string[] = []

  if (workshopName) {
    lines.push(`🚗 ${workshopName}`)
  }

  if (plate) {
    lines.push(`📋 Plaka: ${plate}`)
  }

  if (statusLabel) {
    lines.push(`📌 Durum: ${statusLabel}`)
  }

  lines.push("")

  if (workshopName) {
    lines.push(`Merhaba, aracınızın servis kabul ve işlem özetine aşağıdaki bağlantıdan ulaşabilirsiniz:`)
  } else {
    lines.push("Merhaba, aracınızın BakimX servis kabul ve işlem özetine aşağıdaki bağlantıdan ulaşabilirsiniz:")
  }

  lines.push(publicLink)

  if (totalAmount != null && totalAmount > 0) {
    lines.push("")
    lines.push(`💰 Toplam tutar: ${formatKurus(totalAmount)}`)
  }

  lines.push("")
  lines.push("Bu link yalnızca sizinle paylaşılmıştır ve güvenlidir.")

  return lines.join("\n")
}

export function getWhatsAppShareUrl(text: string): string {
  const encoded = encodeURIComponent(text)
  return `https://wa.me/?text=${encoded}`
}

/**
 * wa.me deep link that targets a specific customer number. The workshop's own
 * WhatsApp opens with the recipient + prefilled text (no Business API needed).
 * Phone is normalised to international TR format (90XXXXXXXXXX).
 */
export function getWhatsAppSendUrl(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "").replace(/^0/, "")
  const intl = digits.startsWith("90") ? digits : `90${digits}`
  const encoded = encodeURIComponent(text)
  return `https://wa.me/${intl}?text=${encoded}`
}

export function buildPublicLink(token: string): string {
  return `/s/${token}`
}