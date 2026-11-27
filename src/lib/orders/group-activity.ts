import { formatTrLongDate, formatTrTime, trDayKey } from "@/lib/format-date"
import { istanbulDayKey } from "@/lib/istanbul-time"

/** Gruplamanın ihtiyaç duyduğu alanlar; `OrderActivityEntry` bunu karşılar. */
export type GroupableActivity = {
  id: string
  at: string // ISO
  actor: string
  action: string
}

export type ActivityRow<T extends GroupableActivity> =
  | { kind: "single"; entry: T }
  | { kind: "run"; key: string; entries: T[] }

export type ActivityDay<T extends GroupableActivity> = {
  /** İstanbul günü: 2026-11-25 */
  key: string
  /** "Bugün" / "Dün" / "25 Kasım 2026" */
  label: string
  rows: ActivityRow<T>[]
}

/** Bu sayıda (dahil) ardışık aynı kişi + aynı olay tek açılır satıra iner; 2 olay daraltılmaz. */
export const MIN_RUN_LENGTH = 3

function dayLabel(key: string, at: Date, todayKey: string, yesterdayKey: string): string {
  if (key === todayKey) return "Bugün"
  if (key === yesterdayKey) return "Dün"
  return formatTrLongDate(at)
}

/** Verilen İstanbul gün anahtarından bir önceki günün anahtarı. */
function previousDayKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
}

/**
 * Girdi sırasını koruyarak (API en yeniden eskiye verir) kayıtları İstanbul
 * gününe böler; her gün içinde aynı kişinin art arda tekrarlayan aynı olaylarını
 * (≥ MIN_RUN_LENGTH) tek satıra indirir. Kişi ya da olay değişince veya gün
 * sınırı geçilince seri biter.
 */
export function groupActivity<T extends GroupableActivity>(entries: T[], now: Date = new Date()): ActivityDay<T>[] {
  const todayKey = istanbulDayKey(now)
  const yesterdayKey = previousDayKey(todayKey)
  const days: ActivityDay<T>[] = []
  let bucket: T[] = []
  let bucketKey = ""

  const flush = () => {
    if (bucket.length === 0) return
    days.push({
      key: bucketKey,
      label: dayLabel(bucketKey, new Date(bucket[0].at), todayKey, yesterdayKey),
      rows: toRows(bucket),
    })
    bucket = []
  }

  for (const entry of entries) {
    const key = trDayKey(entry.at)
    if (key !== bucketKey) {
      flush()
      bucketKey = key
    }
    bucket.push(entry)
  }
  flush()
  return days
}

function toRows<T extends GroupableActivity>(entries: T[]): ActivityRow<T>[] {
  const rows: ActivityRow<T>[] = []
  let i = 0
  while (i < entries.length) {
    let j = i + 1
    while (j < entries.length && entries[j].actor === entries[i].actor && entries[j].action === entries[i].action) j++
    const run = entries.slice(i, j)
    if (run.length >= MIN_RUN_LENGTH) {
      rows.push({ kind: "run", key: run[0].id, entries: run })
    } else {
      for (const entry of run) rows.push({ kind: "single", entry })
    }
    i = j
  }
  return rows
}

/** İlk `limit` satırı (gün başlıklarını koruyarak) döndürür; satır = tek kayıt ya da daraltılmış seri. */
export function limitActivityRows<T extends GroupableActivity>(days: ActivityDay<T>[], limit: number): ActivityDay<T>[] {
  const out: ActivityDay<T>[] = []
  let left = limit
  for (const day of days) {
    if (left <= 0) break
    const rows = day.rows.slice(0, left)
    left -= rows.length
    out.push({ ...day, rows })
  }
  return out
}

/**
 * `limitActivityRows`ın tamamlayıcısı: ilk `limit` satırdan SONRAKİ satırlar.
 * Bir gün sınırda bölünürse devam eden günün `continued` bayrağı true olur
 * (başlığı ilk parçada zaten çizildi).
 */
export function restActivityRows<T extends GroupableActivity>(
  days: ActivityDay<T>[],
  limit: number,
): (ActivityDay<T> & { continued: boolean })[] {
  const out: (ActivityDay<T> & { continued: boolean })[] = []
  let skip = limit
  for (const day of days) {
    if (skip >= day.rows.length) {
      skip -= day.rows.length
      continue
    }
    out.push({ ...day, rows: day.rows.slice(skip), continued: skip > 0 })
    skip = 0
  }
  return out
}

export function countActivityRows<T extends GroupableActivity>(days: ActivityDay<T>[]): number {
  return days.reduce((n, d) => n + d.rows.length, 0)
}

const BULK_SUMMARY: Record<string, (n: number) => string> = {
  order_item_added: (n) => `${n} kalem eklendi`,
  order_item_removed: (n) => `${n} kalem çıkarıldı`,
  order_item_completed: (n) => `${n} kalem yapıldı olarak işaretlendi`,
  order_item_uncompleted: (n) => `${n} kalemin yapıldı işareti kaldırıldı`,
  photo_uploaded: (n) => `${n} fotoğraf eklendi`,
  photo_deleted: (n) => `${n} fotoğraf silindi`,
  damage_mark_added: (n) => `${n} hasar işaretlendi`,
  collection_created: (n) => `${n} tahsilat alındı`,
  collection_cancelled: (n) => `${n} tahsilat iptal edildi`,
}

/**
 * Daraltılmış serinin başlığı. Seridekilerin etiketi aynıysa "<etiket> · N kez";
 * farklıysa (ör. dört ayrı kalemin çıkarılması) ilk kaydın etiketi yanıltır, bu
 * yüzden eyleme özgü genel özet ("4 kalem çıkarıldı") verilir.
 */
export function summarizeRun(entries: { action: string; label: string }[]): string {
  const n = entries.length
  const first = entries[0]
  if (entries.every((e) => e.label === first.label)) return `${first.label} · ${n} kez`
  const bulk = BULK_SUMMARY[first.action]
  return bulk ? bulk(n) : `${n} işlem`
}

/** Seri başlığındaki saat aralığı; başı ve sonu aynı dakikaysa tek saat. */
export function runTimeRange(entries: { at: string }[]): string {
  const start = formatTrTime(entries[entries.length - 1].at)
  const end = formatTrTime(entries[0].at)
  return start === end ? start : `${start}–${end}`
}
