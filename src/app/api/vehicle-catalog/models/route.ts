import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { buildModelQuery } from "@/lib/catalog/model-search"

export async function GET(request: Request) {
  await requireAuth()
  const { searchParams } = new URL(request.url)
  const brandId = Number(searchParams.get("brandId"))
  if (!Number.isInteger(brandId) || brandId <= 0) {
    return NextResponse.json({ error: "brandId zorunludur" }, { status: 400 })
  }
  const q = searchParams.get("q") || undefined
  const models = await prisma.vehicleModel.findMany(buildModelQuery({ brandId, q }))
  return NextResponse.json({ models })
}
