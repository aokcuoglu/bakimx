import { istanbulDayStart } from "@/lib/istanbul-time"

/**
 * Hatırlatma listesindeki tarih filtresinin (`dateFilter`) gün sınırları. Filtre
 * istemcide (`reminder-list.tsx`) uygulanır; sunucu sorgusu (`getRemindersList`)
 * tüm listeyi verir (#935). Günler Türkiye takvimine göredir, sürecin saat diliminden bağımsız
 * (#904): UTC'de koşan bir sunucuda "bugün" TR 03:00'te başlamaz.
 *
 *   "today" → bugünün başı .. yarının başı
 *   "week"  → bugünün başı .. 7 gün sonranın başı (bugün dahil kayan 7 gün)
 *   "month" → bugünün başı .. 30 gün sonranın başı (bugün dahil kayan 30 gün)
 *   diğer   → null ("overdue" dahil — o filtre pencere değil, durum/sınır ister)
 *
 * İstemci güvenlidir: Prisma'ya dokunmaz.
 */

export type ReminderDueWindow = { gte: Date; lt: Date }

export function resolveReminderDueWindow(
  filter: string,
  now: Date = new Date()
): ReminderDueWindow | null {
  if (filter === "today") return { gte: istanbulDayStart(now), lt: istanbulDayStart(now, 1) }
  if (filter === "week") return { gte: istanbulDayStart(now), lt: istanbulDayStart(now, 7) }
  if (filter === "month") return { gte: istanbulDayStart(now), lt: istanbulDayStart(now, 30) }
  return null
}
