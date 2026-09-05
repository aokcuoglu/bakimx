import { BODY_TYPES, VEHICLE_VIEWS, getVehicleGeometry, type BodyType, type VehicleView } from "@/components/damage/vehicle-geometry"
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
  const views = body === "unsupported" ? "" : `<div class="damage-views">${Object.entries(VEHICLE_VIEWS).map(([key, label]) => {
    const geometry = getVehicleGeometry(body, key as VehicleView)
    const paths = geometry.panels.map((p) => `<path d="${p.path}" fill="${p.glass ? "var(--line)" : "var(--surface)"}" stroke="var(--ink)" stroke-width="1.5"/>`).join("")
    const details = geometry.details.map((d) => `<path d="${d}" fill="none" stroke="var(--muted)" stroke-width="1.5"/>`).join("")
    const numbers = geometry.panels.map((panel) => {
      const marks = data.damageMarks.filter((m) => m.zone === panel.id)
      return marks.map((m, i) => `<g transform="translate(${panel.x + (i % 3) * 24 - Math.min(marks.length - 1, 2) * 12},${panel.y + Math.floor(i / 3) * 24})"><circle r="11" fill="var(--primary)"/><text text-anchor="middle" dominant-baseline="central" fill="white" font-size="12" font-weight="700">${m.number}</text></g>`).join("")
    }).join("")
    return `<figure><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 300" role="img" aria-label="${label} görünüş">${paths}${details}${numbers}</svg><figcaption>${label}</figcaption></figure>`
  }).join("")}</div>`
  const cards = data.damageMarks.map((mark) => {
    const photos = data.photos.filter((photo) => mark.photoIds.includes(photo.id))
    const images = photos.map((photo) => {
      const src = reportPhotoSrc(photo.fileUrl)
      return src ? `<figure><img src="${src}" alt="Hasar ${mark.number} fotoğrafı"/><figcaption>#${mark.number} · ${photo.label}</figcaption></figure>` : ""
    }).filter(Boolean)
    return `<article class="damage-card"><h3>#${mark.number} · ${mark.zoneLabel}</h3><p>${mark.damageTypeLabel} · ${mark.severityLabel}</p>${mark.note ? `<p class="damage-note">${mark.note}</p>` : ""}${images.length ? `<div class="damage-images">${images.join("")}</div>` : `<p class="field-sub">${data.photosVisible === false ? "Fotoğraflar bu paylaşımda gösterilmiyor" : "Fotoğraf eklenmedi"}</p>`}</article>`
  }).join("")
  return `<section class="damage-report"><h2 class="section-title">Araç Hasar Kontrolü</h2><p>${inspection}${data.inspectedAt ? ` · ${new Date(data.inspectedAt).toLocaleString("tr-TR")}` : ""}</p><p class="field-sub">${BODY_TYPES[body]} · Temsili şema. Sağ ve sol aracın sürüş yönüne göredir.</p>${views}${cards ? `<h2 class="section-title">Hasar Kayıtları</h2>${cards}` : ""}</section>`
}
