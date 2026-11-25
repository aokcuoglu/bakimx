// İstanbul zaman yardımcıları ortak modüle taşındı (#861 ayrıştırma, #874 gün/ay
// sınırları); mevcut çağıranlar için buradan da ihraç edilir.
export {
  istanbulDateTimeInputValue,
  istanbulDayBounds,
  istanbulMonthBounds,
  parseIstanbulLocalDateTime,
} from "@/lib/istanbul-time"
export type { IstanbulMonthBounds } from "@/lib/istanbul-time"
