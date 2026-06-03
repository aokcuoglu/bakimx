import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: Request) {
  const user = await requireAuth()
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") || "").trim()

  if (!q) {
    return NextResponse.json({ parts: [] })
  }

  const parts = await prisma.partStockItem.findMany({
    where: {
      workshopId: user.workshopId,
      isActive: true,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
        { oemNo: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
        { barcode: { contains: q } },
      ],
    },
    select: {
      id: true,
      name: true,
      sku: true,
      oemNo: true,
      brand: true,
      stockQty: true,
      criticalStockQty: true,
      salePrice: true,
      unit: true,
      isActive: true,
    },
    orderBy: { name: "asc" },
    take: 20,
  })

  return NextResponse.json({ parts })
}
