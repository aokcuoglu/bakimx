import { escapeHtml } from "@/lib/html-escape"
import { BRAND_ICON_PATHS, BRAND_ICON_VIEWBOX, type BrandIconKey } from "@/lib/brand-icons"
import { buildWorkshopContactEntries, type WorkshopContactEntry, type WorkshopPublicContact } from "@/lib/workshop-contact"

/**
 * Marka ikonu inline SVG olarak gömülür — PDF motoru harici `<img src>`
 * yüklemeyebilir. `currentColor` ile tek renk basar, yani satırın soluk rengini
 * devralır (marka renkleri kullanılmıyor; bkz. `brand-icons.ts`).
 *
 * Yol verisi kod içinde sabittir, kullanıcı girdisi değildir; yine de yalnızca
 * bilinen anahtarlar render edilir.
 */
function brandIconSvg(key: BrandIconKey | undefined, size: string): string {
  const path = key ? BRAND_ICON_PATHS[key] : undefined
  if (!path) return ""
  return `<svg viewBox="${BRAND_ICON_VIEWBOX}" width="${size}" height="${size}" fill="currentColor" aria-hidden="true" focusable="false" style="vertical-align:-1px;flex:none;"><path d="${path}"/></svg>`
}

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
  options: { fontSize?: string; color?: string; iconSize?: string } = {}
): string {
  const { channels, socials } = buildWorkshopContactEntries(contact)
  if (channels.length === 0 && socials.length === 0) return ""

  const fontSize = options.fontSize ?? "9px"
  const color = options.color ?? "#666"

  const iconSize = options.iconSize ?? "10px"

  const renderEntry = (entry: WorkshopContactEntry, nowrap: boolean) => {
    const label = escapeHtml(entry.label)
    const value = escapeHtml(entry.value)
    const text = entry.href
      ? `<a href="${escapeHtml(entry.href)}" style="color:inherit;text-decoration:none;">${value}</a>`
      : value
    const icon = brandIconSvg(entry.icon, iconSize)
    // İkon dekoratif: adres metni yanında görünür kalır, çünkü kâğıda basıldığında
    // ikon tek başına hangi hesap olduğunu söylemez.
    const body = icon ? `${icon} ${text}` : `${label}: ${text}`
    return `<span style="${nowrap ? "white-space:nowrap;" : "word-break:break-word;"}">${body}</span>`
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
