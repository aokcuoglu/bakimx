import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { buildUnifiedResults } from "@/lib/search/unified-results"
import { normalizePlate } from "@/lib/format"

export async function GET(request: Request) {
  const user = await requireAuth()
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") || "").trim()
  if (!q) return NextResponse.json({ results: [] })

  // Plates are stored compact (normalizePlate → "34MYL739"), so a spaced query
  // ("34 MYL 739") never matches a raw `contains`. Add a normalized plate clause
  // when it differs from the raw (case-insensitive) query — skip empty (all-punct
  // → "") to avoid a `contains: ""` that would match every plate.
  const plateQ = normalizePlate(q)
  const plateClauses: Prisma.VehicleWhereInput[] =
    plateQ && plateQ !== q.toUpperCase() ? [{ plate: { contains: plateQ, mode: "insensitive" } }] : []

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
          ...plateClauses,
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
