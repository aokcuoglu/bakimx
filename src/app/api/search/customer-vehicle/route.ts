import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { buildUnifiedResults } from "@/lib/search/unified-results"
import { phoneSearchTerm } from "@/lib/search/phone-search"
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

  // Telefon araması iki yönden de biçime takılıyordu (#178): uygulama üzerinden
  // açılan kayıtlarda telefon normalize saklanır ("5445157408") ama kullanıcı
  // ekrandaki biçimi ("0544 515 74 08") yazar; eski/seed kayıtlarda ise tersi
  // geçerli. Ham `contains` ikisini de kaçırır.
  //
  // Çözüm iki katmanlı:
  //  1) Sorguyu rakamlara indirge (`phoneSearchTerm`) → normalize saklanan kaydı
  //     bulur.
  //  2) Kolonu da rakamlara indirgeyip karşılaştır → ayraçlı saklanan kaydı
  //     bulur. Prisma `where`'i sütun üzerinde fonksiyon çağıramadığı için bu
  //     tek adım raw SQL ile id'lere iner (aynı desen: tecdoc katalog araması).
  //     Sorgu atölyeye sabitlenmiştir; `q` bind parametresidir.
  // Üç harften kısa terimlerde 2. katman atlanır: hem gereksiz tarama olur hem
  // de neredeyse tüm kayıtlar eşleşir.
  const phoneQ = phoneSearchTerm(q)
  const phoneDigitMatchIds =
    phoneQ.length >= 3
      ? (
          await prisma.$queryRaw<{ id: string }[]>`
            SELECT id FROM "Customer"
            WHERE "workshopId" = ${user.workshopId}
              AND regexp_replace(phone, '[^0-9]', '', 'g') LIKE ${`%${phoneQ}%`}
            LIMIT 8
          `
        ).map((r) => r.id)
      : []

  const phoneClauses: Prisma.CustomerWhereInput[] = [
    ...(phoneQ && phoneQ !== q ? [{ phone: { contains: phoneQ } } satisfies Prisma.CustomerWhereInput] : []),
    ...(phoneDigitMatchIds.length ? [{ id: { in: phoneDigitMatchIds } } satisfies Prisma.CustomerWhereInput] : []),
  ]

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
          ...phoneClauses,
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
