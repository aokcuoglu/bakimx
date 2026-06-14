import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { PublicSharePage } from "@/components/app/public-share-page"
import { sanitizeIntakeForPublic } from "@/lib/intake/data-safety"
import { calculatePhotoCompletion, groupPhotosByPhase } from "@/lib/intake/completeness"

export const dynamic = "force-dynamic"

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const shareLink = await prisma.publicShareLink.findUnique({
    where: { token },
    include: {
      intakeForm: {
        include: {
          customer: true,
          vehicle: true,
          photos: { select: { id: true, type: true, label: true, fileUrl: true, phase: true } },
          damageMarks: { select: { id: true, zone: true, damageType: true, severity: true, note: true } },
          approvals: { select: { status: true, approvedAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
          timelineEvents: { select: { eventType: true, description: true, createdAt: true }, orderBy: { createdAt: "asc" } },
          order: { select: { id: true, status: true, paymentStatus: true, items: { select: { id: true, type: true, name: true, quantity: true, unitPrice: true, totalPrice: true } } } },
        },
      },
      workshop: { select: { id: true, name: true, phone: true, city: true, address: true, logoUrl: true } },
    },
  })

  if (!shareLink || !shareLink.isActive || (shareLink.expiresAt && shareLink.expiresAt < new Date())) {
    notFound()
  }

  const { intakeForm, workshop } = shareLink

  const workshopSettings = await prisma.workshopSettings.findUnique({
    where: { workshopId: shareLink.workshopId },
    select: { publicPortalLogoUrl: true, themeColor: true, accentColor: true },
  })

  const visibility = {
    showPhotos: shareLink.showPhotos,
    showDamage: shareLink.showDamage,
    showOrderItems: shareLink.showOrderItems,
    showPaymentStatus: shareLink.showPaymentStatus,
    showTimeline: shareLink.showTimeline,
  }

  const safeIntakeForm = sanitizeIntakeForPublic(intakeForm, visibility)

  const photoTypes = intakeForm.photos.map((p) => p.type)
  const photoCompletion = calculatePhotoCompletion(photoTypes)
  const photoGroups = groupPhotosByPhase(
    intakeForm.photos.map((p) => ({
      id: p.id,
      type: p.type,
      label: p.label,
      fileUrl: p.fileUrl,
      phase: p.phase || "intake",
    }))
  )

  const safeShareLink = {
    createdAt: shareLink.createdAt,
    token: shareLink.token,
    showPhotos: shareLink.showPhotos,
    showDamage: shareLink.showDamage,
    showOrderItems: shareLink.showOrderItems,
    showPaymentStatus: shareLink.showPaymentStatus,
    showTimeline: shareLink.showTimeline,
    workshop: {
      name: workshop.name,
      phone: workshop.phone,
      city: workshop.city,
      address: workshop.address,
      logoUrl: workshop.logoUrl,
      branding: workshopSettings ? {
        publicPortalLogoUrl: workshopSettings.publicPortalLogoUrl,
        themeColor: workshopSettings.themeColor,
        accentColor: workshopSettings.accentColor,
      } : null,
    },
    intakeForm: safeIntakeForm,
    photoCompletion,
    photoGroups,
  }

  return <PublicSharePage shareLink={safeShareLink} />
}