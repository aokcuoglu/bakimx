import {
  istanbulDateRange,
  istanbulDayStart,
  istanbulMonthStart,
  istanbulWeekStart,
  type IstanbulDateRange,
} from "@/lib/istanbul-time"

/** Tahsilat listesi dönem filtresi (`/cashbox/payments?period=`). */
export const COLLECTION_PERIOD_PRESETS = [
  { value: "", label: "Tüm Dönem" },
  { value: "today", label: "Bugün" },
  { value: "yesterday", label: "Dün" },
  { value: "this_week", label: "Bu Hafta" },
  { value: "last_week", label: "Geçen Hafta" },
  { value: "this_month", label: "Bu Ay" },
  { value: "last_month", label: "Geçen Ay" },
  { value: "last_30", label: "Son 30 Gün" },
  { value: "last_90", label: "Son 90 Gün" },
  { value: "custom", label: "Özel" },
] as const

/**
 * Dönem filtresini İstanbul takvimine göre yarı açık `[start, end)` aralığına
 * çevirir (#905, #906). Ekran ve CSV dışa aktarımı aynı ham parametrelerden bu
 * fonksiyonla aralık kurar; sorgu (`getCollections`) gün eklemez.
 *
 * Hafta Pazartesi başlar. "Bugün", "Bu Hafta", "Bu Ay", "Son 30/90 Gün" de
 * kapalıdır: bitişleri yarın / gelecek Pazartesi / gelecek ayın 1'i 00:00.
 * `custom` → `dateFrom`/`dateTo` (`YYYY-MM-DD`, ikisi de dahil). Boş ya da
 * bilinmeyen dönem → sınırsız (`{}`).
 */
export function resolveCollectionRange(
  input: { period?: string | null; dateFrom?: string | null; dateTo?: string | null },
  now: Date = new Date(),
): IstanbulDateRange {
  switch (input.period) {
    case "today":
      return { start: istanbulDayStart(now), end: istanbulDayStart(now, 1) }
    case "yesterday":
      return { start: istanbulDayStart(now, -1), end: istanbulDayStart(now) }
    case "this_week":
      return { start: istanbulWeekStart(now), end: istanbulWeekStart(now, 1) }
    case "last_week":
      return { start: istanbulWeekStart(now, -1), end: istanbulWeekStart(now) }
    case "this_month":
      return { start: istanbulMonthStart(now), end: istanbulMonthStart(now, 1) }
    case "last_month":
      return { start: istanbulMonthStart(now, -1), end: istanbulMonthStart(now) }
    case "last_30":
      return { start: istanbulDayStart(now, -29), end: istanbulDayStart(now, 1) }
    case "last_90":
      return { start: istanbulDayStart(now, -89), end: istanbulDayStart(now, 1) }
    case "custom":
      return istanbulDateRange(input.dateFrom, input.dateTo)
    default:
      return {}
  }
}

/** Tahsilat listesinin ham (kullanıcının gönderdiği) filtreleri. */
export type CollectionListFilters = {
  q?: string
  method?: string
  status?: string
  period?: string
  dateFrom?: string
  dateTo?: string
}

/**
 * CSV dışa aktarım bağlantısının sorgu dizgisi. Hesaplanmış tarih DEĞİL, ham
 * filtreler taşınır; rota aralığı aynı `resolveCollectionRange` ile kurar.
 * (Eskiden `dateFrom.toISOString().slice(0, 10)` yazılıyordu: İstanbul gece
 * yarısı UTC'de önceki gün 21:00 olduğundan CSV bir gün erken başlıyordu, `q`
 * de düşüyordu — #906.) `dateFrom`/`dateTo` yalnız özel dönemde gider.
 */
export function collectionExportParams(filters: CollectionListFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.q) params.set("q", filters.q)
  if (filters.method) params.set("method", filters.method)
  if (filters.status) params.set("status", filters.status)
  if (filters.period) params.set("period", filters.period)
  if (filters.period === "custom") {
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom)
    if (filters.dateTo) params.set("dateTo", filters.dateTo)
  }
  return params
}

/**
 * Dışa aktarım rotasının dönem girdisi. `period` taşımayan eski bağlantılar
 * yalnız `dateFrom`/`dateTo` gönderiyordu — onlar özel aralık sayılır.
 */
export function collectionPeriodFromSearchParams(searchParams: URLSearchParams): {
  period: string
  dateFrom: string | null
  dateTo: string | null
} {
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")
  const period = searchParams.get("period") || (dateFrom || dateTo ? "custom" : "")
  return { period, dateFrom, dateTo }
}
