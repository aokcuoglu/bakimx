/**
 * Canlı destek çalışma takvimi — SAF katman.
 *
 * Burada ne Prisma ne de `new Date()` var: her fonksiyon `now`'u parametre alır.
 * Sebep, "şu an açık mıyız?" sorusunun test edilebilir olması. Widget, admin
 * konsolu ve API bu tek kaynağı kullanır; ikinci bir saat mantığı yazılmaz.
 *
 * Saat dilimi: sunucu UTC'de (ECS), yönetici Türkiye'de. Karşılaştırma bu yüzden
 * ham `Date` üzerinde değil, `Intl.DateTimeFormat` ile hedef saat dilimine
 * çevrilmiş DUVAR SAATİ üzerinde yapılır. Gelecekteki bir anın mutlak `Date`
 * karşılığını üretmeye çalışmıyoruz (DST kenar durumu) — "sonraki açılış" takvim
 * günü + saat olarak tarif edilir.
 */

export const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const
export type DayKey = (typeof DAY_KEYS)[number]

export const DAY_LABELS: Record<DayKey, string> = {
  mon: "Pazartesi",
  tue: "Salı",
  wed: "Çarşamba",
  thu: "Perşembe",
  fri: "Cuma",
  sat: "Cumartesi",
  sun: "Pazar",
}

/** Haftanın kullanıcıya gösterim sırası (Pazartesi başlar, Pazar biter). */
export const DISPLAY_ORDER: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

/**
 * `interface` DEĞİL `type`: Prisma'nın `InputJsonValue`'su örtük index imzası
 * ister ve TypeScript bunu yalnız type alias'lara verir. Interface olarak
 * yazılırsa bu takvim Json bir alana yazılamaz.
 */
export type DayWindow = {
  enabled: boolean
  /** "HH:MM", 24 saat. */
  start: string
  /** "HH:MM", 24 saat. `start`'tan büyük olmak zorunda (gece aşırı pencere yok). */
  end: string
}

export type WeeklySchedule = Record<DayKey, DayWindow>

export const DEFAULT_SCHEDULE: WeeklySchedule = {
  mon: { enabled: true, start: "09:00", end: "18:00" },
  tue: { enabled: true, start: "09:00", end: "18:00" },
  wed: { enabled: true, start: "09:00", end: "18:00" },
  thu: { enabled: true, start: "09:00", end: "18:00" },
  fri: { enabled: true, start: "09:00", end: "18:00" },
  sat: { enabled: true, start: "10:00", end: "14:00" },
  sun: { enabled: false, start: "10:00", end: "14:00" },
}

const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value)
}

/** "09:30" -> 570. Geçersiz girdi için null. */
export function toMinutes(time: string): number | null {
  if (!isValidTime(time)) return null
  const [h, m] = time.split(":")
  return Number(h) * 60 + Number(m)
}

/**
 * Veritabanındaki Json'u güvenli şekilde okur. Elle düzenlenmiş / eski şemadan
 * kalmış / kısmi bir değer widget'ı düşürmemeli: eksik gün varsayılana,
 * geçersiz saat o günün varsayılanına düşer.
 */
export function parseWeeklySchedule(raw: unknown): WeeklySchedule {
  const source = (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>
  const out = {} as WeeklySchedule

  for (const key of DAY_KEYS) {
    const fallback = DEFAULT_SCHEDULE[key]
    const value = source[key]
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      out[key] = { ...fallback }
      continue
    }
    const day = value as Record<string, unknown>
    const start = typeof day.start === "string" && isValidTime(day.start) ? day.start : fallback.start
    const end = typeof day.end === "string" && isValidTime(day.end) ? day.end : fallback.end
    const ordered = (toMinutes(start) ?? 0) < (toMinutes(end) ?? 0)
    out[key] = {
      enabled: typeof day.enabled === "boolean" ? day.enabled : fallback.enabled,
      start: ordered ? start : fallback.start,
      end: ordered ? end : fallback.end,
    }
  }

  return out
}

export interface ZonedNow {
  /** 0 = Pazar … 6 = Cumartesi (DAY_KEYS ile aynı sıra). */
  dayIndex: number
  dayKey: DayKey
  /** Gün başlangıcından itibaren dakika. */
  minutes: number
  /** Hedef saat dilimindeki takvim günü, "YYYY-MM-DD". */
  ymd: string
}

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

/**
 * Mutlak bir anı hedef saat dilimindeki duvar saatine çevirir.
 * Geçersiz saat dilimi adında UTC'ye düşer (yapılandırma hatası widget'ı
 * kapatmasın; en kötü ihtimalle saatler 3 saat kayar ve bu görünür bir hatadır).
 */
export function zonedNow(now: Date, timezone: string): ZonedNow {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now)
  } catch {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "UTC",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now)
  }

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? ""
  // `hour12: false` bazı ortamlarda gece yarısını "24" verir; 0'a normalize et.
  const hour = Number(get("hour")) % 24
  const minute = Number(get("minute"))
  const dayIndex = WEEKDAY_TO_INDEX[get("weekday")] ?? 0

  return {
    dayIndex,
    dayKey: DAY_KEYS[dayIndex],
    minutes: hour * 60 + minute,
    ymd: `${get("year")}-${get("month")}-${get("day")}`,
  }
}

/** "YYYY-MM-DD" + n gün. Takvim günü aritmetiği — DST'den etkilenmez. */
export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + days))
  return next.toISOString().slice(0, 10)
}

export interface NextOpening {
  dayKey: DayKey
  dayLabel: string
  /** "HH:MM" */
  time: string
  /** Bugünden kaç gün sonra (0 = bugün, 1 = yarın). */
  daysAhead: number
  ymd: string
}

export interface AvailabilityInput {
  enabled: boolean
  timezone: string
  schedule: WeeklySchedule
  holidays: string[]
}

export interface Availability {
  online: boolean
  /** Neden kapalıyız — kullanıcıya gösterilecek metni seçmek için. */
  reason: "online" | "disabled" | "holiday" | "outside_hours" | "day_off"
  /** Bugünün penceresi (kapalı gün / tatil ise null). */
  todayWindow: DayWindow | null
  nextOpening: NextOpening | null
  /** Hesabın yapıldığı hedef saat dilimindeki an — istemciye de gönderilir. */
  zoned: ZonedNow
}

/** Kapalıysak bir sonraki açılışı bul. Bugünün kalanı dahil, 8 gün tarar. */
function findNextOpening(input: AvailabilityInput, zoned: ZonedNow): NextOpening | null {
  for (let offset = 0; offset < 8; offset++) {
    const key = DAY_KEYS[(zoned.dayIndex + offset) % 7]
    const window = input.schedule[key]
    if (!window.enabled) continue

    const ymd = addDays(zoned.ymd, offset)
    if (input.holidays.includes(ymd)) continue

    const start = toMinutes(window.start)
    if (start === null) continue
    // Bugünün penceresi zaten başladıysa (ve açık olmadığımıza göre bitmişse)
    // bugünü atla.
    if (offset === 0 && zoned.minutes >= start) continue

    return { dayKey: key, dayLabel: DAY_LABELS[key], time: window.start, daysAhead: offset, ymd }
  }
  return null
}

export function evaluateAvailability(input: AvailabilityInput, now: Date): Availability {
  const zoned = zonedNow(now, input.timezone)
  const todayWindow = input.schedule[zoned.dayKey]
  const isHoliday = input.holidays.includes(zoned.ymd)

  if (!input.enabled) {
    return { online: false, reason: "disabled", todayWindow: null, nextOpening: null, zoned }
  }

  if (isHoliday) {
    return {
      online: false,
      reason: "holiday",
      todayWindow: null,
      nextOpening: findNextOpening(input, zoned),
      zoned,
    }
  }

  if (!todayWindow.enabled) {
    return {
      online: false,
      reason: "day_off",
      todayWindow: null,
      nextOpening: findNextOpening(input, zoned),
      zoned,
    }
  }

  const start = toMinutes(todayWindow.start)
  const end = toMinutes(todayWindow.end)
  const online = start !== null && end !== null && zoned.minutes >= start && zoned.minutes < end

  return {
    online,
    reason: online ? "online" : "outside_hours",
    todayWindow,
    nextOpening: online ? null : findNextOpening(input, zoned),
    zoned,
  }
}

/** "Yarın 09:00'da buradayız" gibi tek cümlelik dönüş vaadi. */
export function describeNextOpening(next: NextOpening | null): string | null {
  if (!next) return null
  if (next.daysAhead === 0) return `Bugün ${next.time}'da tekrar buradayız.`
  if (next.daysAhead === 1) return `Yarın ${next.time}'da tekrar buradayız.`
  return `${next.dayLabel} günü ${next.time}'da tekrar buradayız.`
}

/** Ayarlar ekranındaki ve widget'taki "çalışma saatleri" listesi. */
export function scheduleSummary(schedule: WeeklySchedule): { dayKey: DayKey; label: string; text: string }[] {
  return DISPLAY_ORDER.map((dayKey) => ({
    dayKey,
    label: DAY_LABELS[dayKey],
    text: schedule[dayKey].enabled ? `${schedule[dayKey].start} – ${schedule[dayKey].end}` : "Kapalı",
  }))
}

const HOLIDAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** "2026-01-01, 2026-04-23" -> ["2026-01-01","2026-04-23"]. Geçersizler düşer. */
export function parseHolidayList(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[,\n]/)
        .map((v) => v.trim())
        .filter((v) => HOLIDAY_PATTERN.test(v) && !Number.isNaN(Date.parse(v))),
    ),
  ).sort()
}
