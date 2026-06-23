import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/app/app-shell"
import { SupplierDetail } from "@/components/app/supplier-detail"
import { getSupplierById, getSupplierCriticalParts } from "@/lib/suppliers/queries"
import { notFound } from "next/navigation"

export default async function SupplierDetailPage(props: { params: Promise<{ id: string }> }) {
  const { user, workshop } = await getAppData()
  const { id } = await props.params

  const supplier = await getSupplierById(user.workshopId, id)
  if (!supplier) notFound()

  const criticalParts = await getSupplierCriticalParts(user.workshopId, id)

  const serialized = {
    ...supplier,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
    parts: supplier.parts.map((p) => ({
      ...p,
      createdAt: p.createdAt?.toISOString?.() ?? "",
      updatedAt: p.updatedAt?.toISOString?.() ?? "",
    })),
  }

  return (
    <AppShell workshopName={workshop?.name} pageTitle={supplier.name}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <SupplierDetail supplier={serialized as any} criticalParts={criticalParts} />
    </AppShell>
  )
}