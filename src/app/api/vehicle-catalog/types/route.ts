import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: Request) {
  await requireAuth()
  const { searchParams } = new URL(request.url)
  const modelId = Number(searchParams.get("modelId"))
  if (!Number.isInteger(modelId) || modelId <= 0) {
    return NextResponse.json({ error: "modelId zorunludur" }, { status: 400 })
  }

  const model = await prisma.vehicleModel.findUnique({
    where: { id: modelId },
    include: {
      types: {
        orderBy: { name: "asc" },
      },
      brand: true,
    },
  })

  if (!model) {
    return NextResponse.json({ error: "Model bulunamadı" }, { status: 404 })
  }

  const types = model.types.map(t => ({
    id: t.id,
    name: t.name,
    modelId: t.modelId,
    modelName: model.name,
    brandId: model.brandId,
    brandName: model.brand.name,
  }))

  return NextResponse.json({ types })
}
