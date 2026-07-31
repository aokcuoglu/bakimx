import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/layout/app-shell"
import { PartDetail } from "@/components/parts/part-detail"
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
      supplierPrices: {
        include: { supplier: { select: { id: true, name: true, phone: true } } },
        orderBy: [{ isPreferred: "desc" }, { purchasePrice: "asc" }],
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
    supplierPrices: part.supplierPrices.map((p) => ({
      id: p.id,
      supplierId: p.supplierId,
      supplierName: p.supplier.name,
      purchasePrice: p.purchasePrice,
      currency: p.currency,
      supplierSku: p.supplierSku,
      isPreferred: p.isPreferred,
    })),
  }

  return (
    <AppShell workshopName={workshop?.name} pageTitle={part.name}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <PartDetail part={serialized as any} />
    </AppShell>
  )
}
