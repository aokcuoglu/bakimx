/**
 * Tarih/saat BİÇİMLEMENİN tek kaynağı (#861).
 *
 * Her biçimleyici `timeZone: "Europe/Istanbul"` ile çalışır: çıktı sunucunun ya
 * da tarayıcının saat diliminden bağımsızdır. Prod konteyneri UTC'de koşarsa
 * `toLocaleTimeString("tr-TR")` 09:00 randevuyu 06:00 gösterir, gece
 * 00:00–03:00 arası tarihler bir önceki güne düşer. Aynı yardımcı sunucu ve
 * istemci bileşenlerinde kullanıldığı için hidrasyon farkı da doğmaz.
 *
 * Kasıtlı olarak sıfır import: istemci güvenli kalır (`@/lib/format` para
 * yardımcısını ve ayrıştırıcıyı taşıdığı için orası değil). Yeni bir tarih
 * gösterimi buradan biçimlenir; `src/lib/format-date-coverage.test.ts`
 * `timeZone`'suz yeni çağrıları yakalar.
 */

export const TR_TIME_ZONE = "Europe/Istanbul"

export type DateInput = string | Date

const INVALID = "—"

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TR_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

const timeFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TR_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
})

const dateTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TR_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

const shortDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TR_TIME_ZONE,
  day: "numeric",
  month: "short",
})

const dayMonthTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TR_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

const mediumDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TR_TIME_ZONE,
  dateStyle: "medium",
})

const longDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TR_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
})

const todayFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TR_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
})

// `en-CA` yerel ayarı tarihi ISO sırasıyla (YYYY-MM-DD) basar.
const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TR_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

function format(formatter: Intl.DateTimeFormat, input: DateInput): string {
  const date = typeof input === "string" ? new Date(input) : input
  // Geçersiz tarihte `Intl.DateTimeFormat#format` RangeError atar; sayfayı
  // düşürmek yerine boş değer göster.
  if (Number.isNaN(date.getTime())) return INVALID
  return formatter.format(date)
}

/** 25.11.2026 */
export function formatTrDate(input: DateInput): string {
  return format(dateFormatter, input)
}

/** 09:00 */
export function formatTrTime(input: DateInput): string {
  return format(timeFormatter, input)
}

/** 25.11.2026 09:00 */
export function formatTrDateTime(input: DateInput): string {
  return format(dateTimeFormatter, input)
}

/** 25.11 09:00 (yıl yok; yakın tarihli liste satırları) */
export function formatTrDayMonthTime(input: DateInput): string {
  const date = typeof input === "string" ? new Date(input) : input
  if (Number.isNaN(date.getTime())) return INVALID
  // Yılsız gün-ay ayırıcısı ICU sürümüne göre değişiyor (lokal "25.11", CI'daki
  // ICU "25/11" basıyor); parçalardan kurup ayırıcıyı sabitliyoruz.
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {}
  for (const part of dayMonthTimeFormatter.formatToParts(date)) parts[part.type] = part.value
  return `${parts.day}.${parts.month} ${parts.hour}:${parts.minute}`
}

/** 25 Kas */
export function formatTrShortDate(input: DateInput): string {
  return format(shortDateFormatter, input)
}

/** 25 Kas 2026 */
export function formatTrMediumDate(input: DateInput): string {
  return format(mediumDateFormatter, input)
}

/** 25 Kasım 2026 */
export function formatTrLongDate(input: DateInput): string {
  return format(longDateFormatter, input)
}

/** "25 Kasım Çarşamba"; Türkiye gününü verir (#857). */
export function formatTodayTr(input: DateInput): string {
  return format(todayFormatter, input)
}

/** Türkiye takvim günü anahtarı: 2026-11-25. Gün karşılaştırması için. */
export function trDayKey(input: DateInput): string {
  return format(dayKeyFormatter, input)
}
