import { escapeHtml } from "@/lib/html-escape"
import { buildWorkshopContactEntries, type WorkshopContactEntry, type WorkshopPublicContact } from "@/lib/workshop-contact"

/**
 * Atölyenin iletişim / sosyal medya bilgilerini ham HTML çıktılarının (iş emri
 * PDF'i, araç pasaportu PDF'i, makbuz) alt bilgisine basar.
 *
 * Değerlerin tamamı kullanıcı girdisidir ve şablon literaline doğrudan yazıldığı
 * için hem metin hem `href` `escapeHtml` üzerinden geçer. Şema doğrulaması
 * (`normalizeSocialUrl`) `http`/`https` dışındaki şemaları zaten eler.
 *
 * Satırlar `flex-wrap` ile akar: dar kâğıtta/ekranda taşmak yerine alt satıra
 * geçer. Dolu alan yoksa boş string döner — çağıran yerde boş kutu/çizgi kalmaz.
 */
export function renderWorkshopContactHtml(
  contact: WorkshopPublicContact | null | undefined,
  options: { fontSize?: string; color?: string } = {}
): string {
  const { channels, socials } = buildWorkshopContactEntries(contact)
  if (channels.length === 0 && socials.length === 0) return ""

  const fontSize = options.fontSize ?? "9px"
  const color = options.color ?? "#666"

  const renderEntry = (entry: WorkshopContactEntry, nowrap: boolean) => {
    const label = escapeHtml(entry.label)
    const value = escapeHtml(entry.value)
    const text = entry.href
      ? `<a href="${escapeHtml(entry.href)}" style="color:inherit;text-decoration:none;">${value}</a>`
      : value
    return `<span style="${nowrap ? "white-space:nowrap;" : "word-break:break-word;"}">${label}: ${text}</span>`
  }

  const rows = [
    { entries: channels, nowrap: true },
    { entries: socials, nowrap: false },
  ]
    .filter((row) => row.entries.length > 0)
    .map(
      (row) =>
        `<div style="display:flex;flex-wrap:wrap;gap:2px 12px;">${row.entries
          .map((entry) => renderEntry(entry, row.nowrap))
          .join("")}</div>`
    )
    .join("")

  return `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #E5E7EB;font-size:${fontSize};color:${color};line-height:1.7;">${rows}</div>`
}
