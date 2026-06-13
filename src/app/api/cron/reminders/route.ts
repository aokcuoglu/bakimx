import { NextResponse } from "next/server"

const CRON_SECRET = process.env.CRON_SECRET || ""

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const providedSecret = authHeader?.replace("Bearer ", "")

  if (CRON_SECRET && providedSecret !== CRON_SECRET) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 })
  }

  if (!CRON_SECRET && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "CRON_SECRET ayarlanmamış" }, { status: 500 })
  }

  try {
    const { processAppointmentReminders } = await import("@/lib/communications/scheduler")
    const appointmentResult = await processAppointmentReminders()

    const { processMaintenanceReminders } = await import("@/lib/communications/scheduler")
    const maintenanceResult = await processMaintenanceReminders()

    return NextResponse.json({
      success: true,
      appointments: appointmentResult,
      maintenance: maintenanceResult,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  return GET(request)
}