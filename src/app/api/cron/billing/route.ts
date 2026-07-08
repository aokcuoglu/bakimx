import { NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"

const CRON_SECRET = process.env.CRON_SECRET || ""

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

async function handle(request: Request) {
  // CRON_SECRET is REQUIRED in every environment. If it is not configured the
  // endpoint is treated as misconfigured (never silently open).
  if (!CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET ayarlanmamış" },
      { status: 500 }
    )
  }

  const authHeader = request.headers.get("authorization") || ""
  const providedSecret = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : ""

  if (!providedSecret || !safeEqual(providedSecret, CRON_SECRET)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 })
  }

  const startedAt = new Date()
  const { recordCronRun } = await import("@/lib/ops/cron-run")

  try {
    const {
      sweepTrialWarnings,
      sweepSubscriptionWarnings,
      sweepStalePaymentArtifacts,
      sweepUnverifiedRegistrations,
    } = await import("@/lib/billing/lifecycle")
    const trialResult = await sweepTrialWarnings()
    const subscriptionResult = await sweepSubscriptionWarnings()
    const staleResult = await sweepStalePaymentArtifacts()
    const purgeResult = await sweepUnverifiedRegistrations()

    // Record the run for the ops health surface (best-effort; alerts on failures).
    await recordCronRun({
      job: "billing",
      startedAt,
      status: "success",
      processed: trialResult.processed + subscriptionResult.processed + staleResult.processed + purgeResult.processed,
      sent: trialResult.sent + subscriptionResult.sent + staleResult.sent + purgeResult.sent,
      failed: trialResult.failed + subscriptionResult.failed + staleResult.failed + purgeResult.failed,
    })

    return NextResponse.json({
      success: true,
      trial: trialResult,
      subscription: subscriptionResult,
      stale: staleResult,
      purge: purgeResult,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata"
    await recordCronRun({ job: "billing", startedAt, status: "error", errorMessage: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handle(request)
}

export async function POST(request: Request) {
  return handle(request)
}
