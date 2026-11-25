import { trDayKey } from "@/lib/format-date"

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Hatırlatma metnindeki göreli gün sözcüğü; Türkiye takvim gününe göre
 * (UTC'ye değil). Pencere (şimdi → +24 sa) aynı gün de olabilir (#890).
 */
export function appointmentDayWord(appointmentAt: Date, now: Date): string {
  const day = trDayKey(appointmentAt)
  if (day === trDayKey(now)) return "bugün"
  if (day === trDayKey(new Date(now.getTime() + DAY_MS))) return "yarın"
  return "yakında"
}
