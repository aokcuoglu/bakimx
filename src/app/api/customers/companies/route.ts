import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { apiErrorResponse } from "@/lib/api-errors"

/**
 * Atölyenin kayıtlı firma adları (kurumsal müşterilerden, tekil). Araç kabul
 * kartındaki "Kurumsal" sheet'inin otomatik tamamlaması için; liste küçük
 * olduğundan filtre istemcide yapılır. Yalnız oturumdaki atölyenin kayıtları.
 */
export async function GET() {
  try {
    const user = await requireAuth()
    const rows = await prisma.customer.findMany({
      where: { workshopId: user.workshopId, type: "corporate", companyName: { not: null } },
      select: { companyName: true },
      distinct: ["companyName"],
      orderBy: { companyName: "asc" },
      take: 500,
    })
    // Kart firma adını büyük harfe çevirir; "Acme" ile "ACME" tek öneri olsun.
    const seen = new Set<string>()
    const companies: string[] = []
    for (const r of rows) {
      const name = (r.companyName || "").trim().replace(/\s+/g, " ")
      const key = name.toLocaleUpperCase("tr-TR")
      if (!name || seen.has(key)) continue
      seen.add(key)
      companies.push(name)
    }
    return NextResponse.json({ companies })
  } catch (err) {
    return apiErrorResponse(err)
  }
}
