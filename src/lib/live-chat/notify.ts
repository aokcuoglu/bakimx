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

/* -------------------------------------------------------------------------- */
/* Ziyaretçi tarafı: temsilci yanıtını e-posta ile ilet (BAK-99)              */
/* -------------------------------------------------------------------------- */

/**
 * Yukarıdaki yığın kuralının simetriği: temsilci yanıtını üç mesaja bölerse
 * ziyaretçiye üç e-posta gitmemeli.
 *
 * `startsNewBurst` ile aynı üç soruyu sorar, taraflar yer değiştirmiş hâlde:
 * ilk yanıt mı, karşı taraf araya girdi mi, uzun sessizlikten sonra mı geldi.
 */
export interface AgentBurstInput {
  /** Bu yanıttan ÖNCEKİ son temsilci mesajının zamanı (yoksa null). */
  previousAgentMessageAt: Date | null
  /** Son ziyaretçi mesajının zamanı (yoksa null). */
  lastVisitorMessageAt: Date | null
  now: Date
  quietWindowMs?: number
}

export function agentReplyStartsNewBurst(input: AgentBurstInput): boolean {
  const { previousAgentMessageAt, lastVisitorMessageAt, now } = input
  const quiet = input.quietWindowMs ?? QUIET_WINDOW_MS

  // Görüşmedeki ilk temsilci yanıtı her zaman haber edilir.
  if (!previousAgentMessageAt) return true
  // Ziyaretçi araya yazmış; top temsilciye geçmişti, şimdi geri geldi.
  if (lastVisitorMessageAt && lastVisitorMessageAt > previousAgentMessageAt) return true
  // Uzun sessizlikten sonra gelen yanıt yeni bir bildirimi hak eder.
  return now.getTime() - previousAgentMessageAt.getTime() > quiet
}

/**
 * E-posta gövdesine giren yanıt metninin üst sınırı.
 *
 * Ziyaretçi e-postası DOĞRULANMIŞ DEĞİL (widget'ta serbest metin). Yanlış yazılmış
 * ya da başkasına ait bir adrese görüşmenin tamamını göndermek gerçek bir sızıntı
 * olurdu; bu yüzden gövdede yalnız son yanıt özet düzeyinde taşınır, görüşme
 * geçmişi taşınmaz — tam geçmiş yalnız süreli bağlantının arkasında görünür
 * (BAK-99 kararı).
 */
export const VISITOR_EXCERPT_LIMIT = 300

export function excerptForVisitorEmail(body: string, limit: number = VISITOR_EXCERPT_LIMIT): string {
  const trimmed = body.trim()
  if (trimmed.length <= limit) return trimmed
  return `${trimmed.slice(0, limit).trimEnd()}…`
}

export interface AgentReplyNotification {
  visitorName: string
  visitorEmail: string
  /** Temsilcinin yanıtı; gövdeye özetlenerek girer. */
  body: string
  /** Süreli devam bağlantısı — `publicToken` ASLA buraya girmez. */
  resumeUrl: string
}

export function buildAgentReplyEmail(n: AgentReplyNotification): { subject: string; html: string } {
  const name = escapeHtml(n.visitorName)
  const messageHtml = escapeHtml(excerptForVisitorEmail(n.body)).replace(/\n/g, "<br />")

  return {
    subject: "Destek ekibimiz mesajınızı yanıtladı",
    html: renderEmailLayout({
      heading: "Destek ekibimizden yanıt var",
      bodyHtml:
        `<p style="margin:0 0 12px;">Merhaba ${name},</p>` +
        `<p style="margin:0 0 12px;">Canlı destek görüşmenize yanıt verdik:</p>` +
        `<blockquote style="margin:0 0 16px;padding:12px 16px;background:#f8fafc;border-left:3px solid #2563eb;border-radius:0 8px 8px 0;color:#0f172a;font-size:15px;line-height:1.6;">${messageHtml}</blockquote>` +
        `<p style="margin:0 0 4px;">Görüşmenin tamamını görmek ve yanıtlamak için aşağıdaki bağlantıyı kullanın.</p>`,
      cta: { label: "Sohbete dön", url: n.resumeUrl },
      footerNote:
        "Bu bağlantı 7 gün geçerlidir ve yalnız size gönderilmiştir; paylaşmayın. " +
        "Böyle bir görüşme başlatmadıysanız bu e-postayı yok sayabilirsiniz.",
    }),
  }
}

/**
 * Ziyaretçiye bildirimi gönderir. Asla throw etmez — temsilcinin yanıtı bir
 * e-posta hatası yüzünden DÜŞMEZ; mesaj zaten DB'de ve widget'ta görünür.
 */
export async function notifyVisitorOfAgentReply(
  n: AgentReplyNotification,
  deps: Pick<NotifyDeps, "send"> = {},
): Promise<{ sent: boolean }> {
  const send = deps.send ?? ((to, subject, html) => sendEmailDirect(to, subject, html))
  const { subject, html } = buildAgentReplyEmail(n)

  try {
    const result = await send(n.visitorEmail, subject, html)
    if (!result.success) {
      console.error("[live-chat] visitor notification failed:", result.error)
      return { sent: false }
    }
    return { sent: true }
  } catch (err) {
    console.error("[live-chat] visitor notification threw:", err instanceof Error ? err.message : err)
    return { sent: false }
  }
}
