import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  await requireAuth()
  const brands = await prisma.vehicleBrand.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  return NextResponse.json({ brands })
}
