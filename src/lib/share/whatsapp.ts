export function generateWhatsAppShareText(options: {
  publicLink: string
  workshopName?: string
  plate?: string
  statusLabel?: string
  totalAmount?: number | null
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
    lines.push(`💰 Toplam tutar: ₺${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalAmount)}`)
  }

  lines.push("")
  lines.push("Bu link yalnızca sizinle paylaşılmıştır ve güvenlidir.")

  return lines.join("\n")
}

export function getWhatsAppShareUrl(text: string): string {
  const encoded = encodeURIComponent(text)
  return `https://wa.me/?text=${encoded}`
}

export function buildPublicLink(token: string): string {
  return `/s/${token}`
}