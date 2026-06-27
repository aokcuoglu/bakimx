import { prisma } from "@/lib/db"
import { getAdminEmails } from "@/lib/admin"
import { founderAlertEmail } from "@/lib/emails/system-emails"
import { sendEmailDirect } from "@/lib/communications/sender"

export interface CronRunInput {
  job: string
  startedAt: Date
  status: "success" | "error"
  processed?: number
  sent?: number
  failed?: number
  errorMessage?: string | null
}

// Don't re-alert for the same job more than once per window (avoid mail spam on
// a flapping cron).
const ALERT_DEBOUNCE_MS = 6 * 60 * 60 * 1000 // 6h

/**
 * Persist a cron run result and, when it errored or had failures, send a
 * debounced founder alert. Best-effort: never throws — observability must not
 * break the cron itself.
 */
export async function recordCronRun(input: CronRunInput): Promise<void> {
  const failed = input.failed ?? 0
  const isProblem = input.status === "error" || failed > 0

  let runId: string | null = null
  try {
    const run = await prisma.cronRun.create({
      data: {
        job: input.job,
        status: input.status,
        startedAt: input.startedAt,
        finishedAt: new Date(),
        processed: input.processed ?? 0,
        sent: input.sent ?? 0,
        failed,
        errorMessage: input.errorMessage ?? null,
      },
      select: { id: true },
    })
    runId = run.id
  } catch (err) {
    console.error("[recordCronRun] persist failed:", err instanceof Error ? err.message : err)
    return
  }

  if (!isProblem) return

  try {
    // Debounce: skip if we already alerted for this job recently.
    const recentAlert = await prisma.cronRun.findFirst({
      where: { job: input.job, alertedAt: { gte: new Date(Date.now() - ALERT_DEBOUNCE_MS) } },
      select: { id: true },
    })
    if (recentAlert) return

    const to = getAdminEmails()
    if (to.length === 0) return

    const built = founderAlertEmail({
      title: `Cron işi sorunu: ${input.job}`,
      detail:
        input.status === "error"
          ? `"${input.job}" işi hata ile sonuçlandı: ${input.errorMessage ?? "bilinmeyen hata"}.`
          : `"${input.job}" işinde ${failed} başarısız gönderim oldu.`,
    })

    await sendEmailDirect(to.join(","), built.subject, built.html)
    if (runId) {
      await prisma.cronRun.update({ where: { id: runId }, data: { alertedAt: new Date() } })
    }
  } catch (err) {
    console.error("[recordCronRun] alert failed:", err instanceof Error ? err.message : err)
  }
}
