import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { assertPasswordChanged, getCurrentUserWithWorkshop } from "@/lib/auth"
import { resolveFeature } from "@/lib/features"
import { encryptMarketResearchApiKey, validateAnthropicApiKey } from "@/lib/market-research/credential"
import type { PlanTier } from "@/lib/plan"
import { assertWritableOr403 } from "@/lib/plan-guard"

async function ownerContext() {
  const context = await getCurrentUserWithWorkshop()
  const locked = assertWritableOr403(context.workshop)
  if (locked) return { response: locked } as const
  assertPasswordChanged(context.user)
  if (context.user.role !== "owner") {
    return { response: NextResponse.json({ error: "Bu ayarı yalnızca şirket yöneticisi değiştirebilir." }, { status: 403 }) } as const
  }
  if (!(await resolveFeature(context.workshop.id, context.workshop.planTier as PlanTier, "marketResearch"))) {
    return { response: NextResponse.json({ error: "Piyasa araştırması yalnızca Premium pakette kullanılabilir." }, { status: 403 }) } as const
  }
  return { context } as const
}

export async function PUT(request: Request) {
  const authorized = await ownerContext()
  if ("response" in authorized) return authorized.response
  let body: { apiKey?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Geçerli bir istek gövdesi gereklidir." }, { status: 400 })
  }
  let apiKey: string
  try {
    apiKey = validateAnthropicApiKey(body.apiKey)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Geçersiz API anahtarı." }, { status: 400 })
  }
  const encryptedApiKey = encryptMarketResearchApiKey(apiKey)
  const maskedLast4 = apiKey.slice(-4)
  const row = await prisma.marketResearchCredential.upsert({
    where: { workshopId: authorized.context.workshop.id },
    create: { workshopId: authorized.context.workshop.id, encryptedApiKey, maskedLast4, updatedByUserId: authorized.context.user.id },
    update: { encryptedApiKey, maskedLast4, updatedByUserId: authorized.context.user.id },
    select: { maskedLast4: true, updatedAt: true },
  })
  return NextResponse.json({ configured: true, maskedLast4: row.maskedLast4, updatedAt: row.updatedAt.toISOString() })
}

export async function DELETE() {
  const authorized = await ownerContext()
  if ("response" in authorized) return authorized.response
  await prisma.marketResearchCredential.deleteMany({ where: { workshopId: authorized.context.workshop.id } })
  return NextResponse.json({ configured: false })
}
