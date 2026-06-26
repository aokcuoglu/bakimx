import { prisma } from "@/lib/db"
import { getAdminEmails } from "@/lib/admin"

// A reminders run is expected at least daily; flag stale past this age.
const REMINDERS_STALE_HOURS = 26
const REMINDERS_JOB = "reminders"

export interface HealthSummary {
  cronLastRunAt: Date | null
  cronStatus: string | null
  cronStale: boolean
  cronAgeHours: number | null
  failedComms24h: number
  ok: boolean
}

/** Compact signal for the ops home band + the health page header. */
export async function getHealthSummary(): Promise<HealthSummary> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [lastRun, failedComms24h] = await Promise.all([
    prisma.cronRun.findFirst({
      where: { job: REMINDERS_JOB },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true, status: true },
    }),
    prisma.communicationLog.count({ where: { status: "failed", sentAt: { gte: since24h } } }),
  ])

  const ageMs = lastRun ? Date.now() - lastRun.startedAt.getTime() : null
  const cronAgeHours = ageMs != null ? Math.floor(ageMs / 3_600_000) : null
  const cronStale = lastRun == null || (cronAgeHours != null && cronAgeHours >= REMINDERS_STALE_HOURS)

  return {
    cronLastRunAt: lastRun?.startedAt ?? null,
    cronStatus: lastRun?.status ?? null,
    cronStale,
    cronAgeHours,
    failedComms24h,
    ok: !cronStale && (lastRun?.status ?? "success") === "success" && failedComms24h === 0,
  }
}

export interface ConfigCheck {
  label: string
  ok: boolean
  hint: string
}

export interface HealthDetail {
  summary: HealthSummary
  cronRuns: { id: string; status: string; startedAt: Date; sent: number; failed: number; errorMessage: string | null }[]
  failedComms: { id: string; type: string; recipient: string; templateKey: string | null; sentAt: Date; errorMessage: string | null }[]
  failedReminders: { id: string; jobType: string; failedCount: number; executedAt: Date; errorMessage: string | null }[]
  failedSyncs: { id: string; provider: string; status: string; syncedAt: Date; errorMessage: string | null }[]
  configChecks: ConfigCheck[]
}

/** Mask a recipient (email/phone) so PII isn't shown in the ops console. */
function maskRecipient(value: string): string {
  if (value.includes("@")) {
    const [user, domain] = value.split("@")
    const head = user.slice(0, 1)
    return `${head}***@${domain}`
  }
  if (value.length <= 4) return "***"
  return `${value.slice(0, 3)}***${value.slice(-2)}`
}

export async function getHealthDetail(): Promise<HealthDetail> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [summary, cronRuns, failedCommsRaw, failedReminders, failedSyncs] = await Promise.all([
    getHealthSummary(),
    prisma.cronRun.findMany({ orderBy: { startedAt: "desc" }, take: 10 }),
    prisma.communicationLog.findMany({
      where: { status: "failed", sentAt: { gte: since24h } },
      orderBy: { sentAt: "desc" },
      take: 20,
    }),
    prisma.reminderExecutionLog.findMany({
      where: { failedCount: { gt: 0 } },
      orderBy: { executedAt: "desc" },
      take: 10,
    }),
    prisma.calendarSyncLog.findMany({
      where: { status: "failed" },
      orderBy: { syncedAt: "desc" },
      take: 10,
    }),
  ])

  const isProd = process.env.NODE_ENV === "production"
  const configChecks: ConfigCheck[] = [
    { label: "CRON_SECRET ayarlı", ok: !!process.env.CRON_SECRET, hint: "Cron uçları korumasız kalır." },
    {
      label: "SESSION_SECRET yeterli",
      ok: (process.env.SESSION_SECRET || "").length >= 32,
      hint: "Oturum imzası için ≥32 karakter gerekir.",
    },
    {
      label: "ADMIN_EMAILS tanımlı",
      ok: getAdminEmails().length > 0,
      hint: "Boşsa /admin herkese 404 döner.",
    },
    {
      label: "E-posta sağlayıcı (prod)",
      ok: !isProd || (process.env.EMAIL_PROVIDER || "mock") !== "mock",
      hint: "Prod'da gerçek sağlayıcı gerekir (mock değil).",
    },
  ]

  return {
    summary,
    cronRuns: cronRuns.map((r) => ({
      id: r.id,
      status: r.status,
      startedAt: r.startedAt,
      sent: r.sent,
      failed: r.failed,
      errorMessage: r.errorMessage,
    })),
    failedComms: failedCommsRaw.map((c) => ({
      id: c.id,
      type: c.type,
      recipient: maskRecipient(c.recipient),
      templateKey: c.templateKey,
      sentAt: c.sentAt,
      errorMessage: c.errorMessage,
    })),
    failedReminders: failedReminders.map((r) => ({
      id: r.id,
      jobType: r.jobType,
      failedCount: r.failedCount,
      executedAt: r.executedAt,
      errorMessage: r.errorMessage,
    })),
    failedSyncs: failedSyncs.map((s) => ({
      id: s.id,
      provider: s.provider,
      status: s.status,
      syncedAt: s.syncedAt,
      errorMessage: s.errorMessage,
    })),
    configChecks,
  }
}
