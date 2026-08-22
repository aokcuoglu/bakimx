import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"

function safeEqual(a: string, b: string): boolean {
  const aBytes = Buffer.from(a)
  const bBytes = Buffer.from(b)
  return aBytes.length === bBytes.length && timingSafeEqual(aBytes, bBytes)
}

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET ?? ""
  if (!secret) return NextResponse.json({ error: "CRON_SECRET ayarlanmamış" }, { status: 500 })
  const authorization = request.headers.get("authorization") ?? ""
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : ""
  if (!supplied || !safeEqual(supplied, secret)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 })
  }

  const startedAt = new Date()
  const { recordCronRun } = await import("@/lib/ops/cron-run")
  try {
    const [{ getProcurementProvider }, { sweepExternalProcurements }] = await Promise.all([
      import("@/lib/external-procurement/provider"),
      import("@/lib/external-procurement/service"),
    ])
    const result = await sweepExternalProcurements(getProcurementProvider())
    await recordCronRun({
      job: "external-procurements", startedAt, status: "success",
      processed: result.processed, failed: result.failed,
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilinmeyen hata"
    await recordCronRun({ job: "external-procurements", startedAt, status: "error", errorMessage: message })
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: Request) { return handle(request) }
export async function POST(request: Request) { return handle(request) }
