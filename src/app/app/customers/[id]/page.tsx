import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Phone, Mail, User, Car, ClipboardList, ArrowLeft } from "lucide-react"
import { INTAKE_STATUS } from "@/lib/constants"

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, workshop } = await getAppData()

  const customer = await prisma.customer.findFirst({
    where: { id, workshopId: user.workshopId },
    include: {
      vehicles: { orderBy: { createdAt: "desc" } },
      intakes: {
        include: { vehicle: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  })

  if (!customer) notFound()

  return (
    <AppShell workshopName={workshop?.name}>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/app/customers" className="p-2 hover:bg-muted rounded-lg">
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h2 className="text-2xl font-bold">{customer.firstName} {customer.lastName}</h2>
            <p className="text-muted-foreground">Müşteri Detayı</p>
          </div>
        </div>

        <div className="bg-card border rounded-xl p-4 space-y-2">
          <h3 className="font-medium text-sm text-muted-foreground">İletişim Bilgileri</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2">
              <User className="size-4 text-muted-foreground" />
              {customer.firstName} {customer.lastName}
            </div>
            <div className="flex items-center gap-2">
              <Phone className="size-4 text-muted-foreground" />
              {customer.phone}
            </div>
            {customer.email && (
              <div className="flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground" />
                {customer.email}
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="font-medium mb-2">Araçlar ({customer.vehicles.length})</h3>
          {customer.vehicles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground bg-card border rounded-xl">
              <Car className="size-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Henüz araç kaydı yok</p>
              <Link href="/app/vehicles/new" className="text-primary hover:underline text-sm">
                Araç ekle
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {customer.vehicles.map((vehicle) => (
                <div key={vehicle.id} className="p-3 bg-card border rounded-xl">
                  <div className="flex items-center gap-2">
                    <Car className="size-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{vehicle.plate}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {vehicle.brand} {vehicle.model}
                    {vehicle.modelYear && ` • ${vehicle.modelYear}`}
                    {vehicle.mileage && ` • ${vehicle.mileage.toLocaleString("tr-TR")} km`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="font-medium mb-2">Son Kabuller</h3>
          {customer.intakes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground bg-card border rounded-xl">
              <ClipboardList className="size-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Henüz kabul formu yok</p>
              <Link href="/app/intakes/new" className="text-primary hover:underline text-sm">
                Yeni kabul oluştur
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {customer.intakes.map((intake) => {
                const statusInfo = INTAKE_STATUS[intake.status as keyof typeof INTAKE_STATUS]
                return (
                  <Link
                    key={intake.id}
                    href={`/app/intakes/${intake.id}`}
                    className="flex items-center justify-between p-3 bg-card border rounded-xl hover:bg-muted/50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{intake.vehicle.plate}</p>
                      <p className="text-xs text-muted-foreground">{intake.customerComplaint}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${statusInfo?.color || "bg-gray-100 text-gray-800"}`}>
                      {statusInfo?.label || intake.status}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  )
}