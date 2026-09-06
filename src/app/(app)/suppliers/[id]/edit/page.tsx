import { getAppData } from "@/app/(app)/data"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { AppShell } from "@/components/layout/app-shell"
import { SupplierForm } from "@/components/suppliers/supplier-form"
import { getSupplierById } from "@/lib/suppliers/queries"
import { notFound } from "next/navigation"

export default async function EditSupplierPage(props: { params: Promise<{ id: string }> }) {
  const paywall = await getFeaturePaywall("procurement")
  if (paywall) return paywall
  const { user, workshop } = await getAppData()
  const { id } = await props.params

  const supplier = await getSupplierById(user.workshopId, id)
  if (!supplier) notFound()

  const serialized = {
    ...supplier,
    createdAt: supplier.createdAt.toISOString(),
    updatedAt: supplier.updatedAt.toISOString(),
  }

  return (
    <AppShell constrained workshopName={workshop?.name} pageTitle="Tedarikçi Düzenle">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <SupplierForm supplier={serialized as any} />
    </AppShell>
  )
}
