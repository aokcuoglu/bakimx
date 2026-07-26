import { prisma } from "@/lib/db"
import { getCurrentUserWithWorkshop } from "@/lib/auth"
import { assertWritableOr403 } from "@/lib/plan-guard"
import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, workshop } = await getCurrentUserWithWorkshop()
    const locked = assertWritableOr403(workshop)
    if (locked) return locked
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

    // Yalnız public paylaşım sayfası tazelenir; personel tarafını çağıran
    // (work-order-detail.tsx) router.refresh() ile kendisi yeniliyor.
    revalidatePath(`/s/${link.token}`)

    return NextResponse.json({ success: true, isActive })
  } catch {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}