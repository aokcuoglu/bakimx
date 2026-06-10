import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { PartForm } from "@/components/app/part-form"
import { prisma } from "@/lib/db"
import { getActiveSuppliersForSelect } from "@/lib/suppliers/queries"
import { notFound } from "next/navigation"

export default async function EditPartPage(props: { params: Promise<{ id: string }> }) {
  const { user, workshop } = await getAppData()
  const { id } = await props.params

  const part = await prisma.partStockItem.findFirst({
    where: { id, workshopId: user.workshopId },
  })

  if (!part) notFound()

  const suppliers = await getActiveSuppliersForSelect(user.workshopId)

  const serialized = {
    ...part,
    createdAt: part.createdAt.toISOString(),
    updatedAt: part.updatedAt.toISOString(),
  }

  return (
    <AppShell workshopName={workshop?.name} pageTitle={`Düzenle: ${part.name}`}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <PartForm part={serialized as any} suppliers={suppliers} />
    </AppShell>
  )
}
