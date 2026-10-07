import { BODY_TYPES, getVehicleGeometry, type BodyType } from "@/components/damage/vehicle-geometry"
import { escapeHtml } from "@/lib/html-escape"
import type { SafeIntakeData } from "@/lib/intake/data-safety"

/** Only same-origin authorized photo routes can be embedded in this customer report. */
export function reportPhotoSrc(value: string | null): string | null {
  if (!value || !/^\/(?:api\/photos\?|s\/[^/?#]+\/photos\/[^/?#]+(?:\?|$))/.test(value)) return null
  return escapeHtml(value)
}

export function renderDamageReport(data: SafeIntakeData): string {
  if (!data.damageMarks.length && !data.inspectionStatus) return ""
  const body: BodyType = data.bodyType && data.bodyType in BODY_TYPES ? data.bodyType as BodyType : "sedan"
  const inspection = data.damageMarks.length
    ? `${data.damageMarks.length} hasar kaydı`
    : data.inspectionStatus === "no_visible_damage"
      ? "Kontrol edildi, görünür hasar gözlenmedi"
      : "Kontrol kaydı yok"
  const geometry = getVehicleGeometry(body)
  const diagram = body === "unsupported" ? "" : (() => {
    const paths = geometry.panels.map((p) => `<path d="${p.path}" fill="${p.tire ? "var(--ink)" : p.glass ? "var(--line)" : "var(--surface)"}" stroke="var(--ink)" stroke-width="1.1"/>`).join("")
    const details = geometry.details.map((d) => `<path d="${d}" fill="var(--line)" stroke="var(--muted)" stroke-width="1"/>`).join("")
    const labels = geometry.labels.map((l) => `<text x="${l.x}" y="${l.y}"${l.rotate ? ` transform="rotate(${l.rotate} ${l.x} ${l.y})"` : ""} text-anchor="middle" dominant-baseline="central" fill="var(--muted)" font-size="11" font-weight="600" letter-spacing="1.3">${l.text}</text>`).join("")
    const numbers = geometry.panels.map((panel) => {
      const marks = data.damageMarks.filter((m) => m.zone === panel.id)
      return marks.map((m, i) => `<g transform="translate(${panel.x + (i % 3) * 22 - Math.min(marks.length - 1, 2) * 11},${panel.y + Math.floor(i / 3) * 22})"><circle r="10" fill="var(--primary)" stroke="white" stroke-width="1.5"/><text text-anchor="middle" dominant-baseline="central" fill="white" font-size="10.5" font-weight="700">${m.number}</text></g>`).join("")
    }).join("")
    return `<figure class="damage-diagram"><svg xmlns="http://www.w3.org/2000/svg" viewBox="${geometry.viewBox}" stroke-linejoin="round" role="img" aria-label="Araç hasar şeması">${paths}${details}${labels}${numbers}</svg></figure>`
  })()
  const cards = data.damageMarks.map((mark) => {
    const photos = data.photos.filter((photo) => mark.photoIds.includes(photo.id))
    const images = photos.map((photo) => {
      const src = reportPhotoSrc(photo.fileUrl)
      return src ? `<figure><img src="${src}" alt="Hasar ${mark.number} fotoğrafı"/><figcaption>#${mark.number} · ${photo.label}</figcaption></figure>` : ""
    }).filter(Boolean)
    return `<article class="damage-card"><h3>#${mark.number} · ${mark.zoneLabel}</h3><p>${mark.damageTypeLabel} · ${mark.severityLabel}</p>${mark.note ? `<p class="damage-note">${mark.note}</p>` : ""}${images.length ? `<div class="damage-images">${images.join("")}</div>` : `<p class="field-sub">${data.photosVisible === false ? "Fotoğraflar bu paylaşımda gösterilmiyor" : "Fotoğraf eklenmedi"}</p>`}</article>`
  }).join("")
  return `<section class="damage-report"><h2 class="section-title">Araç Hasar Kontrolü</h2><p>${inspection}${data.inspectedAt ? ` · ${new Date(data.inspectedAt).toLocaleString("tr-TR")}` : ""}</p><p class="field-sub">${BODY_TYPES[body]} · Temsili açılım şeması. Sol ve sağ, aracın sürüş yönüne göredir.</p>${diagram}${cards ? `<h2 class="section-title">Hasar Kayıtları</h2>${cards}` : ""}</section>`
}
