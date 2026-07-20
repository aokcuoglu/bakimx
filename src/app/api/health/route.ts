import { NextResponse } from "next/server"

// Liveness probe for the AWS ALB target-group health check and the ECS container health
// check (both GET /api/health and expect 200). Deliberately dependency-free — no DB or
// network — so a transient backend blip never flaps the load-balancer target or triggers a
// deployment circuit-breaker rollback. Deep readiness checks live behind /admin/health
// (see src/lib/ops/health.ts). Middleware lets /api/health through unauthenticated (it is
// neither a public nor a protected API prefix, so the API branch returns next()).
export const dynamic = "force-dynamic"

export function GET() {
  return NextResponse.json({ status: "ok" }, { status: 200 })
}
