import { formatTRY } from "@/lib/format"
import { escapeHtml } from "@/lib/html-escape"
import { bakimxPdfFooterBar } from "@/lib/pdf/brand-footer"

interface ReceiptData {
  reference: string
  planName: string
  cycleLabel: string
  amountMinor: number
  confirmedAt: Date | null
  workshopName: string
  invoiceTitle: string | null
  taxNumber: string | null
  taxOffice: string | null
  address: string | null
}

/** Simple, self-contained HTML receipt (makbuz). NOT a legal e-invoice — that
 *  is issued offline. VAT-included amount. */
export function generateReceiptHtml(d: ReceiptData): string {
  const tl = formatTRY(d.amountMinor / 100)
  const date = (d.confirmedAt ?? new Date()).toLocaleDateString("tr-TR")
  return `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Makbuz ${escapeHtml(d.reference)}</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;max-width:640px;margin:24px auto;padding:0 16px}
  h1{font-size:20px;margin:0 0 4px} .muted{color:#64748b;font-size:13px}
  table{width:100%;border-collapse:collapse;margin:20px 0}
  td{padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:14px}
  td.r{text-align:right;font-weight:600}
  .total td{border-bottom:none;font-size:16px;font-weight:700;padding-top:12px}
</style></head><body>
  <h1>Ödeme Makbuzu</h1>
  <p class="muted">Referans: ${escapeHtml(d.reference)} · ${escapeHtml(date)}</p>
  <p class="muted">${escapeHtml(d.invoiceTitle || d.workshopName)}${d.taxNumber ? " · VKN/TCKN: " + escapeHtml(d.taxNumber) : ""}${d.taxOffice ? " · " + escapeHtml(d.taxOffice) : ""}</p>
  ${d.address ? `<p class="muted">${escapeHtml(d.address)}</p>` : ""}
  <table>
    <tr><td>${escapeHtml(d.planName)} paketi (${escapeHtml(d.cycleLabel)})</td><td class="r">${escapeHtml(tl)}</td></tr>
    <tr class="total"><td>Toplam (KDV dahil)</td><td class="r">${escapeHtml(tl)}</td></tr>
  </table>
  <p class="muted">Bu bir bilgilendirme makbuzudur; yasal fatura ayrıca düzenlenir.</p>
  ${bakimxPdfFooterBar(d.confirmedAt ?? new Date())}
</body></html>`
}
