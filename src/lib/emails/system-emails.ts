import { renderEmailLayout } from "./layout"

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

export function workshopApprovedEmail(p: { firstName: string; workshopName: string }): BuiltEmail {
  const name = escapeHtml(p.firstName || "Yetkili")
  const ws = escapeHtml(p.workshopName)
  return {
    subject: "BakimX hesabınız onaylandı 🎉",
    html: renderEmailLayout({
      heading: "Hesabınız onaylandı",
      bodyHtml:
        `<p style="margin:0 0 12px;">Merhaba ${name},</p>` +
        `<p style="margin:0 0 12px;"><strong>${ws}</strong> için BakimX başvurunuz onaylandı. 15 günlük ücretsiz deneme süreniz başladı.</p>` +
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
    subject: `Yeni iş yeri başvurusu: ${p.workshopName}`,
    html: renderEmailLayout({
      heading: "Yeni iş yeri başvurusu",
      bodyHtml:
        `<p style="margin:0 0 12px;">Yeni bir BakimX deneme başvurusu geldi:</p>` +
        `<p style="margin:0 0 4px;"><strong>İş yeri:</strong> ${ws}</p>` +
        `<p style="margin:0 0 4px;"><strong>Yetkili:</strong> ${owner}</p>` +
        `<p style="margin:0 0 4px;"><strong>E-posta:</strong> ${email}</p>` +
        `<p style="margin:0 0 4px;"><strong>Telefon:</strong> ${phone}</p>` +
        `<p style="margin:0 0 12px;"><strong>Şehir:</strong> ${city}</p>`,
      cta: { label: "Başvuruyu incele", url: `${appUrl()}/admin` },
    }),
  }
}
