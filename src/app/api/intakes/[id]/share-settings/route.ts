import { prisma } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"

type ShareSettings = {
  linkId: string
  showPhotos?: boolean
  showDamage?: boolean
  showOrderItems?: boolean
  showPaymentStatus?: boolean
  showTimeline?: boolean
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body: ShareSettings = await request.json()
    const { linkId, ...settings } = body

    if (!linkId) {
      return NextResponse.json({ error: "linkId gerekli" }, { status: 400 })
    }

    const link = await prisma.publicShareLink.findFirst({
      where: { id: linkId, intakeFormId: id, workshopId: user.workshopId },
    })

    if (!link) {
      return NextResponse.json({ error: "Link bulunamadı" }, { status: 404 })
    }

    const updateData: Record<string, boolean> = {}
    if (typeof settings.showPhotos === "boolean") updateData.showPhotos = settings.showPhotos
    if (typeof settings.showDamage === "boolean") updateData.showDamage = settings.showDamage
    if (typeof settings.showOrderItems === "boolean") updateData.showOrderItems = settings.showOrderItems
    if (typeof settings.showPaymentStatus === "boolean") updateData.showPaymentStatus = settings.showPaymentStatus
    if (typeof settings.showTimeline === "boolean") updateData.showTimeline = settings.showTimeline

    if (Object.keys(updateData).length > 0) {
      await prisma.publicShareLink.update({
        where: { id: linkId },
        data: updateData,
      })
    }

    revalidatePath(`/app/intakes/${id}`)
    revalidatePath(`/s/${link.token}`)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Bir hata oluştu" }, { status: 500 })
  }
}