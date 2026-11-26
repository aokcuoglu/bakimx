import { formatTRY } from "@/lib/format"
import { formatTaxRate } from "@/lib/totals"

/** Zincirin okuduğu toplam alanları (kuruş). `Totals`un alt kümesi. */
export type TotalsChainInput = {
  subtotal: number
  discountAmount: number
  taxAmount: number
}

export type TotalsChainRow = {
  key: "subtotal" | "discount" | "tax"
  label: string
  /** Kuruş; indirim satırı negatiftir. */
  amount: number
}

/**
 * BAK-55 — Genel Toplam kalem tutarlarının toplamı DEĞİLDİR: indirim düşülür,
 * KDV eklenir. Yalnız sonuç görününce (₺400'lük kalemin üstünde ₺240) rakam
 * hatalı sanılıyordu. İndirim ya da KDV varken zincir hep görünür:
 * Ara Toplam → İndirim → KDV → (Genel Toplam). Fark yoksa boş döner, ekran sade kalır.
 *
 * KDV etiketi belgenin GERÇEK oranını yazar (`order.taxRate`, bps). Eskiden oran
 * `taxAmount / (ara toplam − indirim)` ile türetiliyordu; BAK-75'ten sonra
 * kalemlerin bir kısmı KDV'siz olabildiği için bu, %20'lik belgede "%10" yazıyordu.
 *
 * Ödeme kartı (#912) ve telefon özet kartı aynı zinciri buradan okur.
 */
export function orderTotalsChain(totals: TotalsChainInput, taxRateBps: number | null | undefined): TotalsChainRow[] {
  const hasDiscount = totals.discountAmount > 0
  const hasTax = totals.taxAmount > 0
  if (!hasDiscount && !hasTax) return []
  const rows: TotalsChainRow[] = [{ key: "subtotal", label: "Ara Toplam", amount: totals.subtotal }]
  if (hasDiscount) rows.push({ key: "discount", label: "İndirim", amount: -totals.discountAmount })
  if (hasTax) {
    const rate = taxRateBps && taxRateBps > 0 ? ` (${formatTaxRate(taxRateBps)})` : ""
    rows.push({ key: "tax", label: `KDV${rate}`, amount: totals.taxAmount })
  }
  return rows
}

/** Zincir tutarı: indirim gerçek eksi işaretiyle (−₺200,00). */
export function formatChainAmount(amount: number): string {
  return amount < 0 ? `−${formatTRY(-amount)}` : formatTRY(amount)
}

/** Telefon özet kartındaki tek satırlık zincir; zincir yoksa null. */
export function totalsChainText(rows: readonly TotalsChainRow[]): string | null {
  if (rows.length === 0) return null
  return rows.map((row) => `${row.label} ${formatChainAmount(row.amount)}`).join(" · ")
}
