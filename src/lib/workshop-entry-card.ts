import { escapeHtml } from "@/lib/html-escape"

export type WorkshopEntryCard = {
  workshopName: string
  loginCode: string
  entryUrl: string
  logoUrl?: string
}

export function buildEntryWhatsAppText(c: WorkshopEntryCard): string {
  return [
    `${c.workshopName} — BakımX giriş bağlantısı`,
    "",
    `Giriş: ${c.entryUrl}`,
    "",
    `Veya kullanıcı adı + şifreyle giriş yapın:`,
    `İş yeri kodu: ${c.loginCode}`,
  ].join("\n")
}

export function renderEntryCardHtml(c: WorkshopEntryCard): string {
  const e = escapeHtml
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<title>${e(c.workshopName)} — Giriş Kartı</title>
<style>
  @page { size: A5 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: ui-sans-serif, system-ui, "Segoe UI", Roboto, Arial, sans-serif;
    color: #0f172a;
    background: #ffffff;
  }
  .card {
    max-width: 600px;
    height: 100%;
    border: 2px solid #cbd5e1;
    border-radius: 16px;
    padding: 28px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .header {
    display: flex;
    gap: 16px;
    align-items: center;
  }
  .logo {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    background: #f1f5f9;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .logo img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: 8px;
  }
  .title {
    flex: 1;
  }
  .workshop {
    font-size: 11px;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: #64748b;
    margin: 0;
  }
  h1 {
    font-size: 24px;
    font-weight: 700;
    margin: 4px 0 0;
    color: #0f172a;
  }
  .content {
    display: flex;
    gap: 24px;
    align-items: center;
    justify-content: center;
  }
  .qr-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .qr-label {
    font-size: 10px;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: .08em;
  }
  .qr-code {
    width: 120px;
    height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: #ffffff;
  }
  .qr-code img {
    width: 100%;
    height: 100%;
  }
  .divider {
    width: 1px;
    height: 120px;
    background: #e2e8f0;
  }
  .info {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .info-block {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .info-label {
    font-size: 10px;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: .08em;
  }
  .info-value {
    font-size: 18px;
    font-weight: 600;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: #0f172a;
    word-break: break-all;
  }
  .footer {
    text-align: center;
  }
  .footer-text {
    font-size: 11px;
    color: #475569;
    line-height: 1.5;
    margin: 0;
  }
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      ${c.logoUrl ? `<div class="logo"><img src="${e(c.logoUrl)}" alt="" /></div>` : ''}
      <div class="title">
        <p class="workshop">${e(c.workshopName)}</p>
        <h1>BakımX</h1>
      </div>
    </div>

    <div class="content">
      <div class="qr-box">
        <div class="qr-label">QR Kodu Tarayın</div>
        <div class="qr-code">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" style="width:100%;height:100%">
            <!-- Placeholder: QR code will be embedded by print dialog -->
            <rect width="100" height="100" fill="white" stroke="#ccc" stroke-width="1"/>
            <text x="50" y="50" text-anchor="middle" dy=".3em" font-size="8" fill="#999">QR</text>
          </svg>
        </div>
      </div>
      <div class="divider"></div>
      <div class="info">
        <div class="info-block">
          <div class="info-label">İş Yeri Kodu</div>
          <div class="info-value">${e(c.loginCode)}</div>
        </div>
        <div class="info-block">
          <div class="info-label">Kullanıcı Adı + Şifre</div>
          <div class="info-label" style="font-size: 9px; color: #94a3b8; margin-top: 4px;">Kodu girdikten sonra istenir</div>
        </div>
      </div>
    </div>

    <div class="footer">
      <p class="footer-text">${e(c.entryUrl)}</p>
    </div>
  </div>
</body>
</html>`
}
