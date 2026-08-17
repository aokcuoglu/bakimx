import { getAdminEmails } from "@/lib/admin"
import { sendEmailDirect } from "@/lib/communications/sender"
import { renderEmailLayout } from "@/lib/emails/layout"
import { escapeHtml } from "@/lib/html-escape"

/**
 * Ziyaretçi yazdığında platform yöneticilerine e-posta bildirimi.
 *
 * NEDEN `sendSystemEmail` DEĞİL: o yol `workshopId` ZORUNLU istiyor, çünkü her
 * gönderimi `communicationLog`'a bir kiracıya bağlı olarak yazıyor. Canlı destek
 * görüşmesi hiçbir atölyeye ait değil; uydurma bir `workshopId` ile loglamak, o
 * kiracının İletişim Kayıtları ekranına başkasının destek trafiğini düşürürdü
 * (issue #194'ün tam olarak kapattığı sızıntı sınıfı). O yüzden burada
 * `sendEmailDirect` kullanılıyor ve **kayıt tutulmuyor** — bilinçli takas.
 *
 * Gönderim BEST-EFFORT: bu fonksiyon asla throw etmez ve çağıran akışı (ziyaretçinin
 * mesajı) hiçbir koşulda düşürmez. E-posta gitmezse mesaj yine gelen kutusunda.
 */

/** Aynı yanıtsız mesaj yığını için tek e-posta yeter; bu süreden sonrası yeni yığın. */
export const QUIET_WINDOW_MS = 15 * 60_000

export interface BurstInput {
  /** Görüşme bu istekle mi açıldı? */
  isNew: boolean
  /** Bu mesajdan ÖNCEKİ son ziyaretçi mesajının zamanı (yoksa null). */
  previousVisitorMessageAt: Date | null
  /** Son temsilci yanıtının zamanı (yoksa null). */
  lastAgentMessageAt: Date | null
  now: Date
  quietWindowMs?: number
}

/**
 * "Bu mesaj yeni bir yanıtsız yığın başlatıyor mu?" — saf ve test edilebilir.
 *
 * Amaç, hızlı ardışık mesajların (ziyaretçi düşüncesini üç satıra bölerse) üç ayrı
 * e-postaya dönüşmemesi; ama gerçekten yeni bir bekleyişin sessiz kalmaması.
 */
export function startsNewBurst(input: BurstInput): boolean {
  const { isNew, previousVisitorMessageAt, lastAgentMessageAt, now } = input
  const quiet = input.quietWindowMs ?? QUIET_WINDOW_MS

  if (isNew) return true
  if (!previousVisitorMessageAt) return true
  // Temsilci araya yanıt vermiş; top ziyaretçiye geçmişti, şimdi geri geldi.
  if (lastAgentMessageAt && lastAgentMessageAt > previousVisitorMessageAt) return true
  // Uzun sessizlikten sonra gelen mesaj yeni bir bekleyiştir.
  return now.getTime() - previousVisitorMessageAt.getTime() > quiet
}

export interface VisitorMessageNotification {
  visitorName: string
  visitorEmail: string
  visitorPhone: string | null
  body: string
  pageUrl: string | null
  /** Görüşme mesai DIŞINDA başladıysa konu satırında ayırt edilir. */
  startedOffline: boolean
  isNew: boolean
}

export interface NotifyDeps {
  recipients?: () => string[]
  send?: (to: string, subject: string, html: string) => Promise<{ success: boolean; error?: string }>
}

function appUrl(): string {
  return process.env.APP_URL || "http://localhost:3000"
}

export function buildVisitorMessageEmail(n: VisitorMessageNotification): { subject: string; html: string } {
  const name = escapeHtml(n.visitorName)
  const rows: string[] = [
    `<p style="margin:0 0 4px;color:#475569;font-size:13px;">E-posta</p>` +
      `<p style="margin:0 0 12px;"><strong>${escapeHtml(n.visitorEmail)}</strong></p>`,
  ]
  if (n.visitorPhone) {
    rows.push(
      `<p style="margin:0 0 4px;color:#475569;font-size:13px;">Telefon</p>` +
        `<p style="margin:0 0 12px;"><strong>${escapeHtml(n.visitorPhone)}</strong></p>`,
    )
  }
  if (n.pageUrl) {
    rows.push(
      `<p style="margin:0 0 4px;color:#475569;font-size:13px;">Hangi sayfadan</p>` +
        `<p style="margin:0 0 12px;">${escapeHtml(n.pageUrl)}</p>`,
    )
  }

  // Ziyaretçi metni tek satıra sıkışmasın; kaçış ÖNCE, <br> sonra.
  const messageHtml = escapeHtml(n.body).replace(/\n/g, "<br />")

  const subject = n.startedOffline
    ? `Mesai dışı canlı destek mesajı — ${n.visitorName}`
    : `Canlı destek mesajı — ${n.visitorName}`

  return {
    subject,
    html: renderEmailLayout({
      heading: n.isNew ? "Yeni canlı destek görüşmesi" : "Canlı destekte yeni mesaj",
      bodyHtml:
        `<p style="margin:0 0 12px;"><strong>${name}</strong> yazdı:</p>` +
        `<blockquote style="margin:0 0 16px;padding:12px 16px;background:#f8fafc;border-left:3px solid #2563eb;border-radius:0 8px 8px 0;color:#0f172a;font-size:15px;line-height:1.6;">${messageHtml}</blockquote>` +
        rows.join(""),
      cta: { label: "Gelen kutusunu aç", url: `${appUrl()}/admin/live-chat` },
      footerNote: n.startedOffline
        ? "Bu görüşme çalışma saatleri dışında başladı — ziyaretçiye mesai başında dönüleceği söylendi."
        : undefined,
    }),
  }
}

/** Yöneticilere bildirimi gönderir. Asla throw etmez; kaç adrese gittiğini döner. */
export async function notifyAdminsOfVisitorMessage(
  n: VisitorMessageNotification,
  deps: NotifyDeps = {},
): Promise<{ sent: number }> {
  const recipients = (deps.recipients ?? getAdminEmails)()
  if (recipients.length === 0) return { sent: 0 }

  const send = deps.send ?? ((to, subject, html) => sendEmailDirect(to, subject, html))
  const { subject, html } = buildVisitorMessageEmail(n)

  let sent = 0
  for (const to of recipients) {
    try {
      const result = await send(to, subject, html)
      if (result.success) sent += 1
      else console.error("[live-chat] admin notification failed:", to, result.error)
    } catch (err) {
      console.error("[live-chat] admin notification threw:", to, err instanceof Error ? err.message : err)
    }
  }
  return { sent }
}
