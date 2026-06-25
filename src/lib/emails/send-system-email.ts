import { sendEmailDirect } from "@/lib/communications/sender"
import { prisma } from "@/lib/db"
import type { CommunicationResult } from "@/lib/communications/types"

export interface SystemEmailParams {
  to: string
  subject: string
  html: string
  workshopId: string
  templateKey: string
}

export interface SystemEmailLogEntry {
  workshopId: string
  recipient: string
  templateKey: string
  status: "sent" | "failed"
  errorMessage: string | null
  providerId: string | null
}

export interface SystemEmailDeps {
  send?: (to: string, subject: string, html: string) => Promise<CommunicationResult>
  log?: (entry: SystemEmailLogEntry) => Promise<void>
}

async function defaultLog(entry: SystemEmailLogEntry): Promise<void> {
  await prisma.communicationLog.create({
    data: {
      workshopId: entry.workshopId,
      type: "email",
      provider: process.env.EMAIL_PROVIDER || "mock",
      recipient: entry.recipient,
      status: entry.status,
      templateKey: entry.templateKey,
      entityType: null,
      entityId: null,
      errorMessage: entry.errorMessage,
      providerId: entry.providerId,
    },
  })
}

/**
 * Sends a system (non-customer) transactional email and records the attempt.
 * Best-effort: never throws — returns { ok, error? } so callers can ignore failures
 * without breaking the primary flow (registration, approval, rejection).
 */
export async function sendSystemEmail(
  params: SystemEmailParams,
  deps: SystemEmailDeps = {},
): Promise<{ ok: boolean; error?: string }> {
  const send = deps.send ?? ((to, subject, html) => sendEmailDirect(to, subject, html))
  const log = deps.log ?? defaultLog

  let result: CommunicationResult
  try {
    result = await send(params.to, params.subject, params.html)
  } catch (error) {
    result = {
      success: false,
      error: error instanceof Error ? error.message : "E-posta gönderim hatası",
    }
  }

  try {
    await log({
      workshopId: params.workshopId,
      recipient: params.to,
      templateKey: params.templateKey,
      status: result.success ? "sent" : "failed",
      errorMessage: result.error ?? null,
      providerId: result.providerId ?? null,
    })
  } catch (logErr) {
    // Logging must never break the caller.
    console.error("[sendSystemEmail] log failed:", logErr instanceof Error ? logErr.message : logErr)
  }

  return result.success ? { ok: true } : { ok: false, error: result.error }
}
