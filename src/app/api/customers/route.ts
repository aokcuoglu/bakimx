import { createCustomerAction } from "@/app/app/customers/actions"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: Request) {
  const user = await requireAuth()
  const { searchParams } = new URL(request.url)
  const q = (searchParams.get("q") || "").trim()
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 50)

  const where: Record<string, unknown> = { workshopId: user.workshopId }
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { fullName: { contains: q, mode: "insensitive" } },
      { companyName: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
    ]
  }

  const customers = await prisma.customer.findMany({
    where: where as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    select: {
      id: true,
      firstName: true,
      lastName: true,
      fullName: true,
      companyName: true,
      type: true,
      phone: true,
    },
    take: limit,
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({ customers })
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const result = await createCustomerAction(formData)
    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ success: true, id: result.id })
  } catch {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}