import { prisma } from "@/lib/db"
import { PublicSharePage } from "@/components/intake/public-share-page"
import { PublicLinkState } from "@/components/shared/public-link-state"
import { sanitizeIntakeForPublic } from "@/lib/intake/data-safety"
import { groupPhotosByPhase } from "@/lib/intake/completeness"
import { VISIBLE_PHOTO } from "@/lib/intake/photo-visibility"
import { WORKSHOP_PUBLIC_CONTACT_SELECT, pickWorkshopPublicContact } from "@/lib/workshop-contact"
import { ORDER_TOTALS_ITEM_SELECT } from "@/lib/totals"
import { quantityToNumber } from "@/lib/orders/quantity"

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
          // Dış alım (satın alma) fotoğrafları dahili-yalnızdır — müşteri özetine sızmaz.
          photos: { where: { serviceOrderItemId: null, ...VISIBLE_PHOTO }, select: { id: true, type: true, label: true, fileUrl: true, phase: true } },
          damageMarks: { select: { id: true, zone: true, damageType: true, severity: true, note: true } },
          approvals: { select: { status: true, approvedAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
          // `discountAmount` + `taxRate` müşteri özetinin KDV/indirim kırılımını
          // besler; kalem select'i ORDER_TOTALS_ITEM_SELECT'ten gelir (BAK-53).
          order: {
            select: {
              id: true,
              status: true,
              paymentStatus: true,
              discountAmount: true,
              taxRate: true,
              items: { select: { id: true, name: true, ...ORDER_TOTALS_ITEM_SELECT } },
            },
          },
        },
      },
      workshop: { select: { id: true, name: true, phone: true, city: true, address: true, logoUrl: true } },
    },
  })

  if (!shareLink) return <PublicLinkState problem="invalid" />
  if (!shareLink.isActive) return <PublicLinkState problem="inactive" />
  if (shareLink.expiresAt && shareLink.expiresAt < new Date()) return <PublicLinkState problem="expired" />

  const { intakeForm, workshop } = shareLink

  const workshopSettings = await prisma.workshopSettings.findUnique({
    where: { workshopId: shareLink.workshopId },
    select: { publicPortalLogoUrl: true, themeColor: true, accentColor: true, ...WORKSHOP_PUBLIC_CONTACT_SELECT },
  })

  const visibility = {
    showPhotos: shareLink.showPhotos,
    showDamage: shareLink.showDamage,
    showOrderItems: shareLink.showOrderItems,
    showPaymentStatus: shareLink.showPaymentStatus,
  }

  const normalizedIntakeForm = {
    ...intakeForm,
    order: intakeForm.order ? {
      ...intakeForm.order,
      items: intakeForm.order.items.map((item) => ({ ...item, quantity: quantityToNumber(item.quantity) })),
    } : null,
  }
  const safeIntakeForm = sanitizeIntakeForPublic(normalizedIntakeForm, visibility)

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
      contact: pickWorkshopPublicContact(workshopSettings),
    },
    intakeForm: safeIntakeForm,
    photoGroups,
  }

  return <PublicSharePage shareLink={safeShareLink} />
}
