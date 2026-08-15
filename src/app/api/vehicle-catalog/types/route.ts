import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: Request) {
  await requireAuth()
  const { searchParams } = new URL(request.url)

  // Seçili tiplerin adlarını getir (names endpoint)
  const idsParam = searchParams.get("ids")
  if (idsParam) {
    const ids = idsParam.split(",").map(Number).filter(Number.isInteger)
    if (ids.length === 0) return NextResponse.json({ names: {} })

    const types = await prisma.vehicleType.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    })
    const names = Object.fromEntries(types.map((t) => [t.id, t.name]))
    return NextResponse.json({ names })
  }

  // Model için araç tiplerini getir
  const modelId = Number(searchParams.get("modelId"))
  if (!Number.isInteger(modelId) || modelId <= 0) {
    return NextResponse.json({ error: "modelId zorunludur" }, { status: 400 })
  }

  const types = await prisma.vehicleType.findMany({
    where: { modelId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  return NextResponse.json({ types })
}
