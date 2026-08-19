/**
 * İş emri listesindeki "Fatura Durumu" filtresinin ve tablodaki "fatura yok"
 * uyarısının saf mantığı.
 *
 * URL'den gelen `?invoice=` değeri üç şeyden biri olabilir:
 *   ""        → filtre yok (tüm emirler)
 *   "with"    → yalnız fatura numarası girilmiş emirler
 *   "without" → yalnız fatura numarası girilmemiş emirler
 *
 * Tanınmayan değer sessizce filtresiz hâle düşer (elle URL kurcalayan biri
 * sorguyu bozamaz). Filtre statüden bağımsızdır: kullanıcı isterse durum
 * filtresiyle birleştirir. Tablodaki UYARI ise statüye bağlıdır — bkz.
 * `INVOICE_EXPECTED_STATUSES`.
 */

export const INVOICE_WITH = "with"
export const INVOICE_WITHOUT = "without"

/**
 * `invoiceNo` boş string olarak da kaydedilmiş olabilir (alan elle giriliyor;
 * bugünkü action `|| null` yazıyor ama eski kayıtlar için garanti yok), bu
 * yüzden iki filtre de null ve "" durumlarını birlikte ele alır.
 */
export type InvoiceFilterWhere =
  | Record<string, never>
  | { AND: [{ invoiceNo: { not: null } }, { invoiceNo: { not: "" } }] }
  | { OR: [{ invoiceNo: null }, { invoiceNo: "" }] }

export type ResolvedInvoiceFilter = {
  /** Normalize edilmiş değer — form/select'e geri verilecek olan. */
  value: string
  /** Prisma `where` parçası; filtre yoksa boş nesne. */
  where: InvoiceFilterWhere
}

export function resolveInvoiceFilter(raw: string | null | undefined): ResolvedInvoiceFilter {
  const value = (raw || "").trim()

  if (value === INVOICE_WITH) {
    return {
      value: INVOICE_WITH,
      where: { AND: [{ invoiceNo: { not: null } }, { invoiceNo: { not: "" } }] },
    }
  }
  if (value === INVOICE_WITHOUT) {
    return {
      value: INVOICE_WITHOUT,
      where: { OR: [{ invoiceNo: null }, { invoiceNo: "" }] },
    }
  }

  return { value: "", where: {} }
}

/**
 * Faturanın beklendiği statüler. Araç teslime hazır ya da teslim edilmişse iş
 * bitmiştir, fatura kesilmiş olmalıdır. Devam eden emirlerde (taslak, onay,
 * işlemde, parça bekliyor) fatura henüz beklenmez; iptal edilmiş emirde ise
 * hiç beklenmez — bu iki grupta uyarı basılmaz.
 */
export const INVOICE_EXPECTED_STATUSES = ["ready_for_delivery", "delivered"] as const

export function isInvoiceExpected(status: string): boolean {
  return (INVOICE_EXPECTED_STATUSES as readonly string[]).includes(status)
}

/** Fatura beklenen bir emirde numara girilmemiş mi? Uyarı ikonunun tek kaynağı. */
export function isInvoiceMissing(status: string, invoiceNo: string | null | undefined): boolean {
  return isInvoiceExpected(status) && !(invoiceNo || "").trim()
}
