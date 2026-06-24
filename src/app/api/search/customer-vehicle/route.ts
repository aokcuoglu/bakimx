import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { buildUnifiedResults } from "@/lib/search/unified-results"

export async function GET(request: Request) {
  const user = await requireAuth()
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") || "").trim()
  if (!q) return NextResponse.json({ results: [] })

  const customerSelect = Prisma.validator<Prisma.CustomerSelect>()({
    id: true,
    firstName: true,
    lastName: true,
    fullName: true,
    companyName: true,
    type: true,
    phone: true,
  })

  const [customers, vehicles] = await Promise.all([
    prisma.customer.findMany({
      where: {
        workshopId: user.workshopId,
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { fullName: { contains: q, mode: "insensitive" } },
          { companyName: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
        ],
      },
      select: customerSelect,
      take: 8,
      orderBy: { createdAt: "desc" },
    }),
    prisma.vehicle.findMany({
      where: {
        workshopId: user.workshopId,
        OR: [
          { plate: { contains: q, mode: "insensitive" } },
          { vin: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        plate: true,
        brand: true,
        model: true,
        customerId: true,
        customer: { select: customerSelect },
      },
      take: 8,
      orderBy: { createdAt: "desc" },
    }),
  ])

  const results = buildUnifiedResults({ customers, vehicles })
  return NextResponse.json({ results })
}
