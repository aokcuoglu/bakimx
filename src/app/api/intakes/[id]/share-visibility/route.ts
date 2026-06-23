import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await request.json()
    const { linkId, isActive } = body

    if (!linkId || typeof isActive !== "boolean") {
      return NextResponse.json({ error: "linkId ve isActive gerekli" }, { status: 400 })
    }

    const link = await prisma.publicShareLink.findFirst({
      where: { id: linkId, intakeFormId: id, workshopId: user.workshopId },
    })

    if (!link) {
      return NextResponse.json({ error: "Link bulunamadı" }, { status: 404 })
    }

    await prisma.publicShareLink.update({
      where: { id: linkId },
      data: { isActive },
    })

    revalidatePath(`/intakes/${id}`)
    revalidatePath(`/s/${link.token}`)

    return NextResponse.json({ success: true, isActive })
  } catch {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}