export interface EmailLayoutOptions {
  heading: string
  /** Pre-built inner HTML (paragraphs etc.) — caller is responsible for escaping. */
  bodyHtml: string
  cta?: { label: string; url: string }
  footerNote?: string
}

const NAVY = "#0b1f3a"
const CTA_BLUE = "#2563eb"

export function renderEmailLayout(opts: EmailLayoutOptions): string {
  const { heading, bodyHtml, cta, footerNote } = opts

  const ctaHtml = cta
    ? `<tr><td style="padding:12px 0 4px;">
         <a href="${cta.url}" style="display:inline-block;background:${CTA_BLUE};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;font-size:15px;">${cta.label} &rarr;</a>
       </td></tr>`
    : ""

  const footerNoteHtml = footerNote
    ? `<p style="margin:16px 0 0;color:#475569;font-size:13px;line-height:1.6;">${footerNote}</p>`
    : ""

  return `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:${NAVY};padding:20px 28px;">
          <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.3px;">&#9881; BakimX</span>
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 16px;color:${NAVY};font-size:20px;font-weight:700;">${heading}</h1>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="color:#334155;font-size:15px;line-height:1.7;">${bodyHtml}</td></tr>
            ${ctaHtml}
          </table>
          ${footerNoteHtml}
        </td></tr>
        <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 28px;">
          <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">BakimX &middot; Oto Servis Yönetim Sistemi<br>hey@bakimx.com &middot; bakimx.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}
