/**
 * Kullanıcının girdiği tarih+saati (`datetime-local`, `date` + `time`) Türkiye
 * duvar saati olarak yorumlar — sunucunun `TZ`'sinden bağımsız (#861).
 *
 * `new Date("2026-11-25T09:00")` saat dilimi eki olmayan değeri SUNUCU yerel
 * saatinde ayrıştırır: TR saatli sunucuda 06:00Z, UTC sunucuda 09:00Z. Bu
 * yardımcılar ikisini de TR sunucusundaki bugünkü davranışa (06:00Z) sabitler.
 *
 * Gün ve ay sınırları da buradan gelir (#874): "bugün", "bu ay", "son 30 gün"
 * Türkiye takvimine göredir. `setHours(0, 0, 0, 0)` ya da `new Date(y, m, d)`
 * sürecin saat diliminde gece yarısı üretir; prod konteyneri UTC'de koşarsa
 * TR 00:00–03:00 arasındaki kayıtlar önceki güne düşer.
 *
 * Europe/Istanbul 2016'dan beri yıl boyu UTC+03:00'tır (yaz saati yok).
 * İstemci güvenlidir; import yoktur.
 */

export const ISTANBUL_UTC_OFFSET_MS = 3 * 60 * 60 * 1000

const DAY_MS = 24 * 60 * 60 * 1000

/** Europe/Istanbul `datetime-local` değerini sunucu timezone'undan bağımsız UTC'ye çevirir. */
export function parseIstanbulLocalDateTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value)
  if (!match) return null
  const [, year, month, day, hour, minute, second = "00"] = match
  const localAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  )
  const date = new Date(localAsUtc - ISTANBUL_UTC_OFFSET_MS)
  const roundTrip = new Date(date.getTime() + ISTANBUL_UTC_OFFSET_MS)
  if (
    Number.isNaN(date.getTime()) ||
    roundTrip.getUTCFullYear() !== Number(year) ||
    roundTrip.getUTCMonth() !== Number(month) - 1 ||
    roundTrip.getUTCDate() !== Number(day) ||
    roundTrip.getUTCHours() !== Number(hour) ||
    roundTrip.getUTCMinutes() !== Number(minute) ||
    roundTrip.getUTCSeconds() !== Number(second)
  ) return null
  return date
}

/** UTC zamanı `datetime-local` bileşeninin beklediği İstanbul duvar saatine yazar. */
export function istanbulDateTimeInputValue(date: Date): string {
  return new Date(date.getTime() + ISTANBUL_UTC_OFFSET_MS).toISOString().slice(0, 16)
}

export type IstanbulMonthBounds = {
  key: string
  label: string
  start: Date
  end: Date
  previousKey: string
  nextKey: string
  dayCount: number
}

function monthKey(year: number, zeroBasedMonth: number): string {
  return `${year}-${String(zeroBasedMonth + 1).padStart(2, "0")}`
}

/** Europe/Istanbul has remained UTC+03:00 year-round since 2016. These bounds
 * keep the sales agenda independent from the server/container timezone. */
export function istanbulDayBounds(now = new Date()): { start: Date; end: Date } {
  const shifted = new Date(now.getTime() + ISTANBUL_UTC_OFFSET_MS)
  const localMidnightAsUtc = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  )
  const start = new Date(localMidnightAsUtc - ISTANBUL_UTC_OFFSET_MS)
  return { start, end: new Date(start.getTime() + DAY_MS) }
}

/** `YYYY-MM` değerini Europe/Istanbul takvim ayının [start, end) UTC sınırlarına
 * çevirir. Geçersiz değerlerde içinde bulunulan İstanbul ayına döner. */
export function istanbulMonthBounds(value?: string | null, now = new Date()): IstanbulMonthBounds {
  const shiftedNow = new Date(now.getTime() + ISTANBUL_UTC_OFFSET_MS)
  const match = value ? /^(\d{4})-(\d{2})$/.exec(value) : null
  const requestedYear = match ? Number(match[1]) : Number.NaN
  const requestedMonth = match ? Number(match[2]) - 1 : Number.NaN
  const valid = Number.isInteger(requestedYear)
    && requestedYear >= 2000
    && requestedYear <= 2200
    && requestedMonth >= 0
    && requestedMonth <= 11
  const year = valid ? requestedYear : shiftedNow.getUTCFullYear()
  const month = valid ? requestedMonth : shiftedNow.getUTCMonth()
  const localStartAsUtc = Date.UTC(year, month, 1)
  const localEndAsUtc = Date.UTC(year, month + 1, 1)
  const previous = new Date(Date.UTC(year, month - 1, 1))
  const next = new Date(Date.UTC(year, month + 1, 1))

  return {
    key: monthKey(year, month),
    label: new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(localStartAsUtc)),
    start: new Date(localStartAsUtc - ISTANBUL_UTC_OFFSET_MS),
    end: new Date(localEndAsUtc - ISTANBUL_UTC_OFFSET_MS),
    previousKey: monthKey(previous.getUTCFullYear(), previous.getUTCMonth()),
    nextKey: monthKey(next.getUTCFullYear(), next.getUTCMonth()),
    dayCount: Math.round((localEndAsUtc - localStartAsUtc) / DAY_MS),
  }
}

/** `now`'ın düştüğü İstanbul gününün 00:00'ı (UTC an olarak), `offsetDays` gün
 * kaydırılmış: `-90` = 90 gün önceki günün başı, `1` = yarının başı. */
export function istanbulDayStart(now: Date = new Date(), offsetDays = 0): Date {
  const shifted = new Date(now.getTime() + ISTANBUL_UTC_OFFSET_MS)
  const localMidnightAsUtc = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() + offsetDays,
  )
  return new Date(localMidnightAsUtc - ISTANBUL_UTC_OFFSET_MS)
}

/** `now`'ın düştüğü İstanbul ayının 1'i 00:00'ı, `offsetMonths` ay kaydırılmış. */
export function istanbulMonthStart(now: Date = new Date(), offsetMonths = 0): Date {
  const shifted = new Date(now.getTime() + ISTANBUL_UTC_OFFSET_MS)
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + offsetMonths, 1) - ISTANBUL_UTC_OFFSET_MS,
  )
}

/** Anın düştüğü İstanbul gününün `YYYY-MM-DD` anahtarı — günlük grafik kovaları
 * için. `toISOString().slice(0, 10)` UTC gününü verir, TR 00:00–03:00 kaçar. */
export function istanbulDayKey(date: Date): string {
  return new Date(date.getTime() + ISTANBUL_UTC_OFFSET_MS).toISOString().slice(0, 10)
}

export type IstanbulDayBucket = {
  /** `YYYY-MM-DD` (İstanbul günü). */
  key: string
  /** Günün 00:00'ı, UTC an olarak. */
  start: Date
  /** 0 = Pazar … 6 = Cumartesi (`Date#getDay` düzeni). */
  weekday: number
}

/** Son `days` İstanbul günü, eskiden yeniye; son öğe bugündür. */
export function istanbulRecentDays(days: number, now: Date = new Date()): IstanbulDayBucket[] {
  const buckets: IstanbulDayBucket[] = []
  for (let offset = days - 1; offset >= 0; offset--) {
    const start = istanbulDayStart(now, -offset)
    const local = new Date(start.getTime() + ISTANBUL_UTC_OFFSET_MS)
    buckets.push({ key: istanbulDayKey(start), start, weekday: local.getUTCDay() })
  }
  return buckets
}

export type IstanbulMonthBucket = {
  /** `YYYY-MM` (İstanbul ayı). */
  key: string
  start: Date
  /** Bir sonraki ayın başı — aralık [start, end). */
  end: Date
  year: number
  /** 0 tabanlı ay (0 = Ocak). */
  month: number
}

/** Son `months` İstanbul ayı, eskiden yeniye; son öğe içinde bulunulan aydır. */
export function istanbulRecentMonths(months: number, now: Date = new Date()): IstanbulMonthBucket[] {
  const buckets: IstanbulMonthBucket[] = []
  for (let offset = months - 1; offset >= 0; offset--) {
    const start = istanbulMonthStart(now, -offset)
    const local = new Date(start.getTime() + ISTANBUL_UTC_OFFSET_MS)
    const year = local.getUTCFullYear()
    const month = local.getUTCMonth()
    buckets.push({
      key: monthKey(year, month),
      start,
      end: istanbulMonthStart(now, -offset + 1),
      year,
      month,
    })
  }
  return buckets
}

/**
 * Kullanıcının seçtiği `YYYY-MM-DD` gününü (`<input type="date">`, `?dateFrom=`)
 * o İstanbul gününün 00:00'ına çevirir (#906). `new Date("2026-11-25")` UTC gece
 * yarısı verir — TR gününden 3 saat kayık, seçilen günün 00:00–03:00 kayıtları
 * önceki güne düşer. Biçim dışı ya da takvimde olmayan gün (`2026-02-31`) `null`.
 */
export function parseIstanbulDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const localMidnightAsUtc = Date.UTC(year, month, day)
  const check = new Date(localMidnightAsUtc)
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month ||
    check.getUTCDate() !== day
  ) return null
  return new Date(localMidnightAsUtc - ISTANBUL_UTC_OFFSET_MS)
}

/** `now`'ın düştüğü İstanbul haftasının Pazartesi 00:00'ı (UTC an olarak),
 * `offsetWeeks` hafta kaydırılmış: `-1` = geçen haftanın başı, `1` = gelecek
 * haftanın başı (#905). Hafta Pazartesi başlar. */
export function istanbulWeekStart(now: Date = new Date(), offsetWeeks = 0): Date {
  const shifted = new Date(now.getTime() + ISTANBUL_UTC_OFFSET_MS)
  const isoWeekday = shifted.getUTCDay() || 7
  return istanbulDayStart(now, -(isoWeekday - 1) + 7 * offsetWeeks)
}

/** Yarı açık tarih aralığı: `start` dahil, `end` hariç. Boş taraf sınırsızdır. */
export type IstanbulDateRange = { start?: Date; end?: Date }

/**
 * Kullanıcının girdiği `dateFrom`/`dateTo` (`YYYY-MM-DD`, ikisi de dahil) çiftini
 * İstanbul günlerine göre `[start, end)` aralığına çevirir: bitiş günü dahil
 * olduğu için `end` = bitiş gününün ertesi 00:00. Sorgular `gte: start, lt: end`
 * kullanır ve kendileri gün eklemez. Boş ya da geçersiz taraf `undefined` döner;
 * `from > to` ters çevrilmez (boş sonuç).
 */
export function istanbulDateRange(from?: string | null, to?: string | null): IstanbulDateRange {
  const start = from ? parseIstanbulDate(from) : null
  const endDay = to ? parseIstanbulDate(to) : null
  return {
    start: start ?? undefined,
    end: endDay ? new Date(endDay.getTime() + DAY_MS) : undefined,
  }
}
