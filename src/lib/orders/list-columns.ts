/**
 * İş emirleri tablosunun veri kolon sırası. Teknisyen en sonda durur;
 * işlem kolonu tabloda bunun sağına, kaydırmada sabitlenmiş olarak eklenir.
 */
export const ORDER_LIST_DATA_COLUMN_ORDER = [
  "workOrderNo",
  "vehicle",
  "customer",
  "status",
  "payment",
  "invoice",
  "total",
  "dates",
  "delivery",
  "technician",
] as const

export const ORDER_LIST_COLUMN_LABELS: Record<(typeof ORDER_LIST_DATA_COLUMN_ORDER)[number], string> = {
  workOrderNo: "İş No",
  vehicle: "Araç",
  customer: "Müşteri",
  status: "Durum",
  payment: "Ödeme",
  invoice: "Fatura",
  total: "Toplam",
  dates: "Giriş tarihi",
  delivery: "Tahmini teslim",
  technician: "Teknisyen",
}

/** Kolon filtresi. Türkçe İ/i ayrımını `toLocaleLowerCase("tr")` ile korur. */
export function matchesColumnFilter(haystack: string, query: unknown): boolean {
  const q = String(query ?? "").trim().toLocaleLowerCase("tr")
  if (!q) return true
  return haystack.toLocaleLowerCase("tr").includes(q)
}
