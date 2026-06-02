import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { PublicSharePage } from "@/components/app/public-share-page"

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
          photos: { select: { id: true, type: true, label: true, fileUrl: true } },
          damageMarks: { select: { id: true, zone: true, damageType: true, severity: true, note: true } },
          approvals: { select: { status: true, approvedAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
          order: { select: { id: true, status: true, items: { select: { id: true, type: true, name: true, quantity: true, unitPrice: true, totalPrice: true } } } },
        },
      },
      workshop: { select: { id: true, name: true, phone: true, city: true, address: true, logoUrl: true } },
    },
  })

  if (!shareLink || !shareLink.isActive || (shareLink.expiresAt && shareLink.expiresAt < new Date())) {
    notFound()
  }

  const { intakeForm, workshop } = shareLink

  const safeShareLink = {
    createdAt: shareLink.createdAt,
    workshop: {
      name: workshop.name,
      phone: workshop.phone,
      city: workshop.city,
      address: workshop.address,
      logoUrl: workshop.logoUrl,
    },
    intakeForm: {
      status: intakeForm.status,
      mileageAtIntake: intakeForm.mileageAtIntake,
      customerComplaint: intakeForm.customerComplaint,
      approvedAt: intakeForm.approvedAt,
      createdAt: intakeForm.createdAt,
      vehicle: {
        plate: intakeForm.vehicle.plate,
        brand: intakeForm.vehicle.brand,
        model: intakeForm.vehicle.model,
        modelYear: intakeForm.vehicle.modelYear,
        mileage: intakeForm.vehicle.mileage,
        vin: intakeForm.vehicle.vin,
      },
      customer: {
        firstName: intakeForm.customer.firstName,
        lastName: intakeForm.customer.lastName,
        fullName: intakeForm.customer.fullName,
        companyName: intakeForm.customer.companyName,
        contactName: intakeForm.customer.contactName,
        type: intakeForm.customer.type,
        phone: intakeForm.customer.phone,
      },
      photos: intakeForm.photos.map((p) => ({
        id: p.id,
        type: p.type,
        label: p.label,
        fileUrl: p.fileUrl,
      })),
      damageMarks: intakeForm.damageMarks.map((dm) => ({
        zone: dm.zone,
        damageType: dm.damageType,
        severity: dm.severity,
        note: dm.note,
      })),
      approvals: intakeForm.approvals,
      order: intakeForm.order
        ? {
            status: intakeForm.order.status,
            items: intakeForm.order.items.map((i) => ({
              type: i.type,
              name: i.name,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              totalPrice: i.totalPrice,
            })),
          }
        : null,
    },
    token: shareLink.token,
  }

  return <PublicSharePage shareLink={safeShareLink} />
}