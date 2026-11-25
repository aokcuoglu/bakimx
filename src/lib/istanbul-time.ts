/**
 * Kullanıcının girdiği tarih+saati (`datetime-local`, `date` + `time`) Türkiye
 * duvar saati olarak yorumlar — sunucunun `TZ`'sinden bağımsız (#861).
 *
 * `new Date("2026-11-25T09:00")` saat dilimi eki olmayan değeri SUNUCU yerel
 * saatinde ayrıştırır: TR saatli sunucuda 06:00Z, UTC sunucuda 09:00Z. Bu
 * yardımcılar ikisini de TR sunucusundaki bugünkü davranışa (06:00Z) sabitler.
 *
 * Europe/Istanbul 2016'dan beri yıl boyu UTC+03:00'tır (yaz saati yok).
 * İstemci güvenlidir; import yoktur.
 */

export const ISTANBUL_UTC_OFFSET_MS = 3 * 60 * 60 * 1000

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
