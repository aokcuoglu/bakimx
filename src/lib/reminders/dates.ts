import { istanbulDayKey, istanbulDayStart } from "@/lib/istanbul-time"

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Kayıtlı hatırlatma tarihini `<input type="date">` / form değerine (`YYYY-MM-DD`)
 * çevirir (#933). Yeni kayıtlar İstanbul gece yarısı (21:00Z), eskiler UTC gece
 * yarısıdır (00:00Z); ikisi de aynı İstanbul gününe düşer. `toISOString().slice(0, 10)`
 * yeni kayıtta bir gün geri kayar ve her kayıtta tarihi bir gün daha geriletir.
 */
export function reminderDateInputValue(date: Date | null | undefined): string {
  return date ? istanbulDayKey(date) : ""
}

/**
 * `dueDate`'e kaç İstanbul günü kaldığı (geçmişte negatif, bugün 0). Saat farkını
 * değil takvim gününü sayar; iki kayıt biçiminde de aynı sonucu verir.
 */
export function reminderDaysUntil(dueDate: Date, now: Date = new Date()): number {
  return Math.round((istanbulDayStart(dueDate).getTime() - istanbulDayStart(now).getTime()) / DAY_MS)
}
