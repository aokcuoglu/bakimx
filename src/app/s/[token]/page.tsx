import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { PublicSharePage } from "@/components/app/public-share-page"

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const shareLink = await prisma.publicShareLink.findUnique({
    where: { token },
    include: {
      intakeForm: {
        include: {
          customer: true,
          vehicle: true,
          photos: true,
          damageMarks: true,
          approvals: { orderBy: { createdAt: "desc" }, take: 1 },
          order: { include: { items: true } },
        },
      },
      workshop: true,
    },
  })

  if (!shareLink || !shareLink.isActive) {
    notFound()
  }

  if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
    notFound()
  }

  return <PublicSharePage shareLink={shareLink} />
}

export const dynamic = "force-dynamic"