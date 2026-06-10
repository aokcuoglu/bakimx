import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { PartDetail } from "@/components/app/part-detail"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"

export default async function PartDetailPage(props: { params: Promise<{ id: string }> }) {
  const { user, workshop } = await getAppData()
  const { id } = await props.params

  const part = await prisma.partStockItem.findFirst({
    where: { id, workshopId: user.workshopId },
    include: {
      movements: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      supplier: {
        select: { id: true, name: true, phone: true },
      },
    },
  })

  if (!part) notFound()

  const serialized = {
    ...part,
    createdAt: part.createdAt.toISOString(),
    updatedAt: part.updatedAt.toISOString(),
    movements: part.movements.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
  }

  return (
    <AppShell workshopName={workshop?.name} pageTitle={part.name}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <PartDetail part={serialized as any} />
    </AppShell>
  )
}
