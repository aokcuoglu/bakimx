import { getAppData } from "@/app/app/data"
import { hasFeature, type PlanTier } from "@/lib/plan"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { IntakeDetail } from "@/components/app/intake-detail"

export default async function IntakeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, workshop } = await getAppData()
  const hasAiAdvisor = !!workshop && hasFeature(workshop.planTier as PlanTier, "aiAdvisor")

  const intake = await prisma.vehicleIntakeForm.findFirst({
    where: { id, workshopId: user.workshopId },
    include: {
      customer: true,
      vehicle: true,
      photos: {
        select: {
          id: true,
          type: true,
          phase: true,
          label: true,
          required: true,
          fileUrl: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          storageProvider: true,
          note: true,
        },
      },
      damageMarks: true,
      approvals: { orderBy: { createdAt: "desc" }, take: 1 },
      shareLinks: { where: { isActive: true }, take: 1 },
      timelineEvents: { orderBy: { createdAt: "asc" } },
      order: { include: { items: true } },
    },
  })

  if (!intake) notFound()

  return (
    <AppShell workshopName={workshop?.name} pageTitle={`Araç Kabulü • ${intake.vehicle.plate}`}>
      <IntakeDetail intake={intake} hasAiAdvisor={hasAiAdvisor} />
    </AppShell>
  )
}