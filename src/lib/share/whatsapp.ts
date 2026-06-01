export function generateWhatsAppShareText(options: {
  publicLink: string
  workshopName?: string
  totalAmount?: number | null
}): string {
  const { publicLink, workshopName, totalAmount } = options

  const lines: string[] = []

  if (workshopName) {
    lines.push(`Merhaba, aracınızın ${workshopName} BakimX servis kabul ve işlem özetine aşağıdaki bağlantıdan ulaşabilirsiniz:`)
  } else {
    lines.push("Merhaba, aracınızın BakimX servis kabul ve işlem özetine aşağıdaki bağlantıdan ulaşabilirsiniz:")
  }

  lines.push(publicLink)

  if (totalAmount != null && totalAmount > 0) {
    lines.push(`Toplam tutar: ₺${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalAmount)}`)
  }

  return lines.join("\n")
}

export function getWhatsAppShareUrl(text: string): string {
  const encoded = encodeURIComponent(text)
  return `https://wa.me/?text=${encoded}`
}

export function buildPublicLink(token: string): string {
  return `/s/${token}`
}