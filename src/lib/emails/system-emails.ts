import { renderEmailLayout } from "./layout"
import { formatMinor } from "@/lib/billing/pricing"

export interface BuiltEmail {
  subject: string
  html: string
}

function appUrl(): string {
  return process.env.APP_URL || "http://localhost:3000"
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function formatTrDate(d: Date): string {
  return d.toLocaleDateString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function workshopApprovedEmail(p: { firstName: string; workshopName: string }): BuiltEmail {
  const name = escapeHtml(p.firstName || "Yetkili")
  const ws = escapeHtml(p.workshopName)
  return {
    subject: "BakimX hesabınız onaylandı 🎉",
    html: renderEmailLayout({
      heading: "Hesabınız onaylandı",
      bodyHtml:
        `<p style="margin:0 0 12px;">Merhaba ${name},</p>` +
        `<p style="margin:0 0 12px;"><strong>${ws}</strong> için BakimX başvurunuz onaylandı. 7 günlük ücretsiz deneme süreniz başladı.</p>` +
        `<p style="margin:0 0 12px;">Hemen giriş yaparak iş yerinizi kurmaya başlayabilirsiniz.</p>`,
      cta: { label: "Giriş Yap", url: `${appUrl()}/login` },
      footerNote: "Bu e-postayı, BakimX'e iş yeri başvurusu yaptığınız için aldınız.",
    }),
  }
}

export function workshopRejectedEmail(p: { firstName: string; workshopName: string }): BuiltEmail {
  const name = escapeHtml(p.firstName || "Yetkili")
  const ws = escapeHtml(p.workshopName)
  return {
    subject: "BakimX başvurunuz hakkında",
    html: renderEmailLayout({
      heading: "Başvurunuz onaylanmadı",
      bodyHtml:
        `<p style="margin:0 0 12px;">Merhaba ${name},</p>` +
        `<p style="margin:0 0 12px;"><strong>${ws}</strong> için yaptığınız BakimX başvurusu şu an için onaylanmadı.</p>` +
        `<p style="margin:0 0 12px;">Bunun bir hata olduğunu düşünüyorsanız veya sorularınız varsa bizimle iletişime geçebilirsiniz.</p>`,
      footerNote: "İletişim: hey@bakimx.com",
    }),
  }
}

export function applicationReceivedEmail(p: { firstName: string; workshopName: string }): BuiltEmail {
  const name = escapeHtml(p.firstName || "Yetkili")
  const ws = escapeHtml(p.workshopName)
  return {
    subject: "BakimX başvurunuz alındı",
    html: renderEmailLayout({
      heading: "Başvurunuz alındı",
      bodyHtml:
        `<p style="margin:0 0 12px;">Merhaba ${name},</p>` +
        `<p style="margin:0 0 12px;"><strong>${ws}</strong> için BakimX başvurunuzu aldık. Ekibimiz başvurunuzu inceledikten sonra hesabınız onaylandığında e-posta ile bilgilendirileceksiniz.</p>` +
        `<p style="margin:0 0 12px;">Onay sonrası 15 günlük ücretsiz deneme süreniz başlayacaktır.</p>`,
      footerNote: "Bu otomatik bir bilgilendirme mesajıdır.",
    }),
  }
}

/** Sent the moment a self-serve registration/checkout completes — the account is
 *  active immediately (no admin approval step) and the trial starts now. */
export function welcomeTrialEmail(p: {
  ownerName: string
  workshopName: string
  trialEndsAt: Date
}): BuiltEmail {
  const name = escapeHtml(p.ownerName || "Yetkili")
  const ws = escapeHtml(p.workshopName)
  const trialEndsFormatted = p.trialEndsAt.toLocaleDateString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
  return {
    subject: "BakimX'e hoş geldiniz — 7 günlük deneme süreniz başladı",
    html: renderEmailLayout({
      heading: "Hesabınız hazır",
      bodyHtml:
        `<p style="margin:0 0 12px;">Merhaba ${name},</p>` +
        `<p style="margin:0 0 12px;"><strong>${ws}</strong> için BakimX hesabınız oluşturuldu ve kullanıma hazır. ` +
        `7 günlük ücretsiz deneme süreniz başladı; <strong>${trialEndsFormatted}</strong> tarihine kadar tüm özellikleri kullanabilirsiniz.</p>` +
        `<p style="margin:0 0 12px;">Hemen giriş yaparak iş yerinizi kurmaya başlayabilirsiniz.</p>`,
      cta: { label: "Giriş Yap", url: `${appUrl()}/login` },
      footerNote: `Deneme süreniz bittiğinde size uygun bir paket seçebilirsiniz: <a href="${appUrl()}/billing">${appUrl()}/billing</a>`,
    }),
  }
}

export function newApplicationAdminEmail(p: {
  workshopName: string
  ownerName: string
  email: string
  phone: string
  city: string
}): BuiltEmail {
  const ws = escapeHtml(p.workshopName)
  const owner = escapeHtml(p.ownerName)
  const email = escapeHtml(p.email)
  const phone = escapeHtml(p.phone)
  const city = escapeHtml(p.city)
  return {
    subject: `Yeni iş yeri kaydı: ${p.workshopName}`,
    html: renderEmailLayout({
      heading: "Yeni iş yeri kaydı",
      bodyHtml:
        `<p style="margin:0 0 12px;">Yeni bir BakimX iş yeri kaydı oluşturuldu (hesap zaten aktif, 7 günlük deneme başladı):</p>` +
        `<p style="margin:0 0 4px;"><strong>İş yeri:</strong> ${ws}</p>` +
        `<p style="margin:0 0 4px;"><strong>Yetkili:</strong> ${owner}</p>` +
        `<p style="margin:0 0 4px;"><strong>E-posta:</strong> ${email}</p>` +
        `<p style="margin:0 0 4px;"><strong>Telefon:</strong> ${phone}</p>` +
        `<p style="margin:0 0 12px;"><strong>Şehir:</strong> ${city}</p>`,
      cta: { label: "Kaydı incele", url: `${appUrl()}/admin` },
    }),
  }
}

/** Internal ops alert to the founders (ADMIN_EMAILS) — not tenant-scoped. Used
 *  for system-health issues like a failed or stale cron run. */
export function founderAlertEmail(p: { title: string; detail: string }): BuiltEmail {
  const title = escapeHtml(p.title)
  const detail = escapeHtml(p.detail)
  return {
    subject: `BakimX uyarı: ${p.title}`,
    html: renderEmailLayout({
      heading: "Sistem uyarısı",
      bodyHtml:
        `<p style="margin:0 0 12px;"><strong>${title}</strong></p>` +
        `<p style="margin:0 0 12px;">${detail}</p>`,
      cta: { label: "Sistem sağlığını gör", url: `${appUrl()}/admin/health` },
      footerNote: "Bu, BakimX yönetici ekibine giden otomatik bir sistem uyarısıdır.",
    }),
  }
}

/** Deneme süresinin bitişine yaklaşırken (T-3/T-1) ve bittiğinde (T-0) gönderilen
 *  uyarı — gerçek kalan gün sayısını gösterir (eşik değeri değil). */
export function trialExpiryWarningEmail(p: {
  ownerName: string
  workshopName: string
  daysLeft: number
  trialEndsAt: Date
}): BuiltEmail {
  const name = escapeHtml(p.ownerName || "Yetkili")
  const ws = escapeHtml(p.workshopName)
  const trialEndsFormatted = formatTrDate(p.trialEndsAt)
  const isExpired = p.daysLeft <= 0

  const heading = isExpired ? "Deneme süreniz sona erdi" : `Deneme sürenizin bitmesine ${p.daysLeft} gün kaldı`
  const bodyHtml = isExpired
    ? `<p style="margin:0 0 12px;">Merhaba ${name},</p>` +
      `<p style="margin:0 0 12px;"><strong>${ws}</strong> için 7 günlük ücretsiz deneme süreniz ${trialEndsFormatted} tarihinde sona erdi.</p>` +
      `<p style="margin:0 0 12px;">Mevcut verileriniz (müşteri, araç, iş emri kayıtlarınız) güvende ve salt-okunur kilitte tutuluyor; bir paket seçtiğinizde kaldığınız yerden devam edebilirsiniz.</p>`
    : `<p style="margin:0 0 12px;">Merhaba ${name},</p>` +
      `<p style="margin:0 0 12px;"><strong>${ws}</strong> için 7 günlük ücretsiz deneme süreniz <strong>${trialEndsFormatted}</strong> tarihinde sona erecek.</p>` +
      `<p style="margin:0 0 12px;">Kesintisiz kullanmaya devam etmek için şimdi bir paket seçebilirsiniz.</p>`

  return {
    subject: heading,
    html: renderEmailLayout({
      heading,
      bodyHtml,
      cta: { label: "Paket seç", url: `${appUrl()}/checkout` },
      footerNote: "Bu, deneme sürenizle ilgili otomatik bir bilgilendirmedir.",
    }),
  }
}

/** Abonelik döneminin bitişine yaklaşırken (T-7/T-3/T-1) ve bittiğinde (T-0)
 *  gönderilen uyarı — gerçek kalan gün sayısını gösterir (eşik değeri değil). */
export function subscriptionExpiryWarningEmail(p: {
  ownerName: string
  workshopName: string
  daysLeft: number
  currentPeriodEnd: Date
  planTier: string
}): BuiltEmail {
  const name = escapeHtml(p.ownerName || "Yetkili")
  const ws = escapeHtml(p.workshopName)
  const periodEndFormatted = formatTrDate(p.currentPeriodEnd)
  const plan = escapeHtml(p.planTier)
  const isExpired = p.daysLeft <= 0

  const heading = isExpired ? "Aboneliğiniz sona erdi" : `Aboneliğinizin bitmesine ${p.daysLeft} gün kaldı`
  const bodyHtml = isExpired
    ? `<p style="margin:0 0 12px;">Merhaba ${name},</p>` +
      `<p style="margin:0 0 12px;"><strong>${ws}</strong> için <strong>${plan}</strong> paketi aboneliğiniz ${periodEndFormatted} tarihinde sona erdi.</p>` +
      `<p style="margin:0 0 12px;">Verileriniz güvende ve salt-okunur kilitte tutuluyor; aboneliğinizi yenilediğinizde kaldığınız yerden devam edebilirsiniz.</p>`
    : `<p style="margin:0 0 12px;">Merhaba ${name},</p>` +
      `<p style="margin:0 0 12px;"><strong>${ws}</strong> için <strong>${plan}</strong> paketi aboneliğiniz <strong>${periodEndFormatted}</strong> tarihinde sona erecek.</p>` +
      `<p style="margin:0 0 12px;">Kesintisiz kullanmaya devam etmek için şimdi yenileyebilirsiniz.</p>`

  return {
    subject: heading,
    html: renderEmailLayout({
      heading,
      bodyHtml,
      cta: { label: "Yenile", url: `${appUrl()}/checkout` },
      footerNote: "Bu, aboneliğinizle ilgili otomatik bir bilgilendirmedir.",
    }),
  }
}

/** Başarılı kart ödemesi sonrası gönderilen makbuz özeti. Yasal e-fatura DEĞİL
 *  (bkz. src/lib/billing/receipt.ts'in aynı dildeki uyarısı) — yalnızca
 *  bilgilendirme amaçlıdır. */
export function paymentReceiptEmail(p: {
  workshopName: string
  planLabel: string
  cycleLabel: string
  amountMinor: number
  maskedPan: string | null
  periodEnd: Date
  reference: string
}): BuiltEmail {
  const ws = escapeHtml(p.workshopName)
  const planLabel = escapeHtml(p.planLabel)
  const cycleLabel = escapeHtml(p.cycleLabel)
  const amount = escapeHtml(formatMinor(p.amountMinor))
  const reference = escapeHtml(p.reference)
  const periodEndFormatted = formatTrDate(p.periodEnd)
  const maskedPanHtml = p.maskedPan
    ? `<p style="margin:0 0 4px;"><strong>Kart:</strong> ${escapeHtml(p.maskedPan)}</p>`
    : ""

  return {
    subject: "Ödemeniz alındı",
    html: renderEmailLayout({
      heading: "Ödemeniz alındı",
      bodyHtml:
        `<p style="margin:0 0 12px;">Merhaba,</p>` +
        `<p style="margin:0 0 12px;"><strong>${ws}</strong> için ödemeniz başarıyla alındı.</p>` +
        `<p style="margin:0 0 4px;"><strong>Paket:</strong> ${planLabel} (${cycleLabel})</p>` +
        `<p style="margin:0 0 4px;"><strong>Tutar:</strong> ${amount}</p>` +
        maskedPanHtml +
        `<p style="margin:0 0 4px;"><strong>Referans:</strong> ${reference}</p>` +
        `<p style="margin:0 0 12px;"><strong>Yeni dönem bitişi:</strong> ${periodEndFormatted}</p>`,
      footerNote: "Bu bir bilgilendirme makbuzudur; yasal fatura ayrıca düzenlenir.",
    }),
  }
}
