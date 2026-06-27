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
    const { processAppointmentReminders, processMaintenanceReminders } = await import(
      "@/lib/communications/scheduler"
    )
    const appointmentResult = await processAppointmentReminders()
    const maintenanceResult = await processMaintenanceReminders()

    // Record the run for the ops health surface (best-effort; alerts on failures).
    await recordCronRun({
      job: "reminders",
      startedAt,
      status: "success",
      processed: appointmentResult.processed + maintenanceResult.processed,
      sent: appointmentResult.sent + maintenanceResult.sent,
      failed: appointmentResult.failed + maintenanceResult.failed,
    })

    return NextResponse.json({
      success: true,
      appointments: appointmentResult,
      maintenance: maintenanceResult,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata"
    await recordCronRun({ job: "reminders", startedAt, status: "error", errorMessage: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  return handle(request)
}

export async function POST(request: Request) {
  return handle(request)
}
