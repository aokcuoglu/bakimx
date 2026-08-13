import { escapeHtml } from "@/lib/html-escape"

/**
 * E-postasız kullanıcının giriş bilgilerini PAYLAŞILABİLİR hâle getiren saf
 * metin/HTML üreticileri (BAK-37).
 *
 * Geçici şifre yalnız üretildiği anda, tek bir sunucu cevabında görünür. Sahip
 * onu ya kopyalar, ya WhatsApp'tan yollar, ya da yazdırıp ustaya verir — bu üç
 * yol da buradan çıkar ki metin tek yerde durup testlenebilsin.
 *
 * Modül BİLEREK saf: prisma/DOM/node bağımlılığı yok, client bileşeni de import
 * edebiliyor. Yazdırma işini çağıran taraf yapar (bkz. member-credentials-dialog).
 */

export type MemberCredentials = {
  workshopName: string
  /** `Workshop.loginCode` — kullanıcı adı yolunda hangi tenant olduğunu çözen bilgi. */
  loginCode: string
  /** Mutlak giriş adresi (ör. `https://app.bakimx.com/login`). */
  loginUrl: string
  fullName: string
  username: string
  tempPassword: string
}

/**
 * WhatsApp'a düşecek düz metin. Şifreyi taşıdığı için sonunda AÇIKÇA "bu mesajı
 * silin" uyarısı var: mesaj, ustanın telefonunda kalıcı bir düz metin şifreye
 * dönüşmesin.
 */
export function buildCredentialsWhatsAppText(c: MemberCredentials): string {
  return [
    `${c.workshopName} — BakımX giriş bilgileriniz`,
    "",
    `Ad Soyad: ${c.fullName}`,
    `İş yeri kodu: ${c.loginCode}`,
    `Kullanıcı adı: ${c.username}`,
    `Geçici şifre: ${c.tempPassword}`,
    "",
    `Giriş: ${c.loginUrl}`,
    "",
    "İlk girişte şifrenizi değiştirmeniz istenecek. Değiştirdikten sonra lütfen bu mesajı silin.",
  ].join("\n")
}

/**
 * Yazdırılabilir kart — tek başına ayakta duran bir HTML belgesi.
 *
 * Uygulamanın kendi sayfasını yazdırmak yerine ayrı belge üretiyoruz: kart bir
 * iframe/pencere içinde basılınca sayfanın geri kalanı (ekip listesi, menü,
 * diğer kullanıcılar) kâğıda çıkmaz. Servis duvarına asılan/ustaya verilen kâğıt
 * yalnız o kişinin bilgisini taşımalı.
 *
 * Stil gömülü ve Tailwind'den bağımsız — belge uygulamanın CSS'ini görmez.
 */
export function renderCredentialsCardHtml(c: MemberCredentials): string {
  const e = escapeHtml
  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<title>${e(c.fullName)} — Giriş bilgileri</title>
<style>
  @page { size: A5; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: ui-sans-serif, system-ui, "Segoe UI", Roboto, Arial, sans-serif;
    color: #0f172a;
    background: #ffffff;
  }
  .card { max-width: 460px; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; }
  .workshop { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #64748b; }
  h1 { font-size: 18px; margin: 4px 0 2px; }
  .name { font-size: 14px; color: #475569; margin: 0 0 16px; }
  dl { margin: 0; }
  .row { display: flex; justify-content: space-between; gap: 12px; align-items: baseline;
         padding: 8px 0; border-top: 1px solid #e2e8f0; }
  dt { font-size: 12px; color: #64748b; }
  dd { margin: 0; font-size: 16px; font-weight: 600;
       font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
  .note { margin-top: 16px; font-size: 11px; line-height: 1.5; color: #475569; }
  .link { margin-top: 4px; font-size: 11px; color: #475569; word-break: break-all; }
</style>
</head>
<body>
  <div class="card">
    <div class="workshop">${e(c.workshopName)}</div>
    <h1>BakımX giriş bilgileri</h1>
    <p class="name">${e(c.fullName)}</p>
    <dl>
      <div class="row"><dt>İş yeri kodu</dt><dd>${e(c.loginCode)}</dd></div>
      <div class="row"><dt>Kullanıcı adı</dt><dd>${e(c.username)}</dd></div>
      <div class="row"><dt>Geçici şifre</dt><dd>${e(c.tempPassword)}</dd></div>
    </dl>
    <p class="note">
      İlk girişte şifrenizi değiştirmeniz istenecek. Bu kâğıdı şifrenizi
      değiştirdikten sonra imha edin — şifre burada açık yazılıdır.
    </p>
    <p class="link">${e(c.loginUrl)}</p>
  </div>
</body>
</html>`
}
