import { istanbulDayStart } from "@/lib/istanbul-time"

/**
 * Randevu listesindeki tarih filtresi (`?date=`) ve "Bugün" / "Yaklaşan"
 * sayaçlarının gün sınırları. Günler Türkiye takvimine göredir, sunucunun saat
 * diliminden bağımsız (#874): UTC'de koşan bir sunucuda TR 00:00–03:00 arasındaki
 * randevu önceki güne düşmez.
 *
 *   "today"    → bugünün başı .. yarının başı
 *   "tomorrow" → yarının başı .. öbür günün başı
 *   "week"     → bugünün başı .. 7 gün sonranın başı (bugün dahil kayan 7 gün)
 *   diğer      → null (tarih filtresi yok)
 */

export type AppointmentDateWindow = { gte: Date; lt: Date }

export function resolveAppointmentDateWindow(
  filter: string,
  now: Date = new Date()
): AppointmentDateWindow | null {
  if (filter === "today") return { gte: istanbulDayStart(now), lt: istanbulDayStart(now, 1) }
  if (filter === "tomorrow") return { gte: istanbulDayStart(now, 1), lt: istanbulDayStart(now, 2) }
  if (filter === "week") return { gte: istanbulDayStart(now), lt: istanbulDayStart(now, 7) }
  return null
}

/** Sayaçlar için bugünün ve yarının başı: "Bugün" = [today, tomorrow), "Yaklaşan" = tomorrow ve sonrası. */
export function appointmentTodayBounds(now: Date = new Date()): { today: Date; tomorrow: Date } {
  return { today: istanbulDayStart(now), tomorrow: istanbulDayStart(now, 1) }
}
