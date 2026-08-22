import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { sanitizeIntakeForPublic, escapeIntakeForHtml } from "@/lib/intake/data-safety"
import { renderIntakePrintoutHtml } from "@/lib/pdf/intake-printout"
import { VISIBLE_PHOTO } from "@/lib/intake/photo-visibility"
import { WORKSHOP_PUBLIC_CONTACT_SELECT, pickWorkshopPublicContact } from "@/lib/workshop-contact"
import { ORDER_TOTALS_ITEM_SELECT } from "@/lib/totals"
import { quantityToNumber } from "@/lib/orders/quantity"

export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const shareLink = await prisma.publicShareLink.findUnique({
    where: { token },
    include: {
      intakeForm: {
        include: {
          customer: true,
          vehicle: true,
          // Dış alım (satın alma) fotoğrafları dahili-yalnızdır — müşteri PDF'ine sızmaz.
          photos: { where: { serviceOrderItemId: null, ...VISIBLE_PHOTO }, select: { id: true, type: true, label: true, fileUrl: true, phase: true } },
          damageMarks: { select: { zone: true, damageType: true, severity: true, note: true } },
          approvals: { select: { status: true, approvedAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
          // Ekrandaki özetle aynı kırılımı basar — indirim/KDV alanları ve
          // satır bazlı `includeVat` bayrağı olmadan PDF KDV'yi düşürür.
          order: {
            select: {
              status: true,
              paymentStatus: true,
              discountAmount: true,
              taxRate: true,
              items: { select: { name: true, ...ORDER_TOTALS_ITEM_SELECT } },
            },
          },
        },
      },
      workshop: { select: { name: true, phone: true, city: true, address: true, logoUrl: true } },
    },
  })

  if (!shareLink || !shareLink.isActive || (shareLink.expiresAt && shareLink.expiresAt < new Date())) {
    notFound()
  }

  const { intakeForm, workshop } = shareLink

  const workshopSettings = await prisma.workshopSettings.findUnique({
    where: { workshopId: shareLink.workshopId },
    select: {
      pdfLogoUrl: true,
      themeColor: true,
      accentColor: true,
      workOrderTemplate: true,
      ...WORKSHOP_PUBLIC_CONTACT_SELECT,
    },
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
  const safeIntakeForm = escapeIntakeForHtml(sanitizeIntakeForPublic(normalizedIntakeForm, visibility))

  const photoTypes = intakeForm.photos.map((p) => p.type)
  const { calculatePhotoCompletion } = await import("@/lib/intake/completeness")
  const photoCompletion = calculatePhotoCompletion(photoTypes)

  const html = renderIntakePrintoutHtml({
    workshop,
    intakeForm: safeIntakeForm,
    branding: workshopSettings ? { pdfLogoUrl: workshopSettings.pdfLogoUrl, themeColor: workshopSettings.themeColor, accentColor: workshopSettings.accentColor } : undefined,
    contact: pickWorkshopPublicContact(workshopSettings),
    customTemplate: workshopSettings?.workOrderTemplate || null,
    createdAt: shareLink.createdAt,
    photoCompletion,
  })

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  })
}
