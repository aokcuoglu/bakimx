/**
 * Kabulde ölçülen yakıt seviyesi.
 *
 * DB'de yüzde olarak saklanır ama yalnızca çeyrek kademelere izin verilir —
 * böylece ileride 1/8 kademe istenirse şema değişmez, sadece bu liste büyür.
 * Kullanıcıya her zaman kesir olarak ("1/4", "1/2") gösterilir.
 *
 * DİKKAT: 0 ("E") geçerli bir ölçümdür. Kod tabanında km için yaygın olan
 * `value || null` kalıbı bu alanda değeri sessizce siler; her yerde `?? null`
 * ve `!= null` kullanılmalı.
 */
export const FUEL_LEVELS = [0, 25, 50, 75, 100] as const

export type FuelLevel = (typeof FUEL_LEVELS)[number]

const FUEL_LEVEL_LABELS: Record<FuelLevel, string> = {
  0: "E",
  25: "1/4",
  50: "1/2",
  75: "3/4",
  100: "Full",
}

export function isFuelLevel(value: unknown): value is FuelLevel {
  return typeof value === "number" && (FUEL_LEVELS as readonly number[]).includes(value)
}

export function formatFuelLevel(value: number): string {
  return isFuelLevel(value) ? FUEL_LEVEL_LABELS[value] : `%${value}`
}

/** Düşük yakıt eşiği: ibre ve etiket uyarı tonuna geçer. */
export function isLowFuel(value: number): boolean {
  return value <= 25
}

/**
 * Kadran geometrisi: merkez (50,50), yay yarıçapı 40, E solda (180°) F sağda (0°).
 * viewBox "0 0 100 62" varsayılır — hem React bileşeni hem PDF çıktısı bunu kullanır.
 */
export function fuelNeedlePoint(value: number, radius = 30): { x: number; y: number } {
  const clamped = Math.min(100, Math.max(0, value))
  const rad = ((180 - (clamped / 100) * 180) * Math.PI) / 180
  return { x: 50 + radius * Math.cos(rad), y: 50 - radius * Math.sin(rad) }
}

/**
 * PDF çıktıları HTML string üretiyor (React değil), bu yüzden kadranın string
 * karşılığı burada duruyor. Sayısal değerler dışında dışarıdan içerik almaz —
 * enjeksiyon yüzeyi yoktur.
 */
export function fuelGaugeSvgMarkup(value: number, width = 64): string {
  const clamped = Math.min(100, Math.max(0, value))
  const color = isLowFuel(clamped) ? "#B91C1C" : "#0B1F3A"
  const needle = fuelNeedlePoint(clamped)
  const arcEnd = fuelNeedlePoint(clamped, 40)
  const height = Math.round(width * 0.62)
  const progress =
    clamped > 0
      ? `<path d="M 10 50 A 40 40 0 0 1 ${arcEnd.x.toFixed(2)} ${arcEnd.y.toFixed(2)}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round"/>`
      : ""
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 100 62">`,
    `<path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#E2E8F0" stroke-width="8" stroke-linecap="round"/>`,
    progress,
    `<line x1="50" y1="50" x2="${needle.x.toFixed(2)}" y2="${needle.y.toFixed(2)}" stroke="${color}" stroke-width="3.5" stroke-linecap="round"/>`,
    `<circle cx="50" cy="50" r="4" fill="${color}"/>`,
    `<text x="4" y="61" font-size="11" fill="#64748B">E</text>`,
    `<text x="86" y="61" font-size="11" fill="#64748B">F</text>`,
    `</svg>`,
  ].join("")
}
