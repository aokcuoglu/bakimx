import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import { VehicleCreateForm } from "@/components/app/vehicle-create-form"
import Link from "next/link"

export default async function NewVehiclePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>
}) {
  const { user, workshop } = await getAppData()
  const { customerId } = await searchParams

  const customers = await prisma.customer.findMany({
    where: { workshopId: user.workshopId },
    orderBy: [{ type: "asc" }, { firstName: "asc" }],
  })

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Yeni Araç" showGlobalSearch={false}>
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center text-sm text-muted-foreground">
              <Link href="/app/vehicles" className="hover:text-foreground">Araçlar</Link>
              <span className="mx-2">/</span>
              <span className="text-foreground font-medium">Yeni Araç</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground mt-1">Yeni Araç</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Araç bilgilerini eksiksiz girin</p>
          </div>
        </div>

        {customers.length === 0 ? (
          <div className="text-center py-16 px-4 text-muted-foreground bg-card border border-dashed border-border rounded-lg">
            <p className="text-base font-medium text-foreground">Önce bir müşteri oluşturmalısınız</p>
            <p className="text-sm mt-1">Araç eklemek için müşteri kaydı gereklidir</p>
            <Link
              href="/app/customers/new"
              className="inline-flex items-center gap-1.5 mt-4 text-sm text-primary hover:text-primary/80 font-medium"
            >
              + Müşteri Oluştur
            </Link>
          </div>
        ) : (
          <VehicleCreateForm customers={customers} mode="create" prefillCustomerId={customerId} />
        )}

        <div className="h-16 sm:hidden" />
      </div>
    </AppShell>
  )
}
