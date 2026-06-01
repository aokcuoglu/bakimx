import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Phone, Mail, User, Car, ClipboardList } from "lucide-react"
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
    <AppShell workshopName={workshop?.name} pageTitle={`${customer.firstName} ${customer.lastName}`}>
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-center text-sm text-slate-500">
          <Link href="/app/customers" className="hover:text-slate-700">Müşteriler</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700 font-medium">{customer.firstName} {customer.lastName}</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
          <h3 className="font-medium text-xs text-slate-500 uppercase tracking-wider">İletişim Bilgileri</h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2 text-slate-900 font-medium">
              <User className="size-4 text-slate-500" />
              {customer.firstName} {customer.lastName}
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Phone className="size-4 text-slate-500" />
              {customer.phone}
            </div>
            {customer.email && (
              <div className="flex items-center gap-2 text-slate-600">
                <Mail className="size-4 text-slate-500" />
                {customer.email}
              </div>
            )}
          </div>
        </div>

        <div>
          <h3 className="font-semibold text-slate-900 mb-2">Araçlar ({customer.vehicles.length})</h3>
          {customer.vehicles.length === 0 ? (
            <div className="text-center py-8 text-slate-500 bg-white border border-slate-200 rounded-xl">
              <Car className="size-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">Henüz araç kaydı yok</p>
              <Link href="/app/vehicles/new" className="text-blue-600 hover:text-blue-700 text-sm">
                Araç ekle
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {customer.vehicles.map((vehicle) => (
                <div key={vehicle.id} className="p-3 bg-white border border-slate-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Car className="size-4 text-slate-500" />
                    <span className="font-semibold text-sm text-slate-900">{vehicle.plate}</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
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
          <h3 className="font-semibold text-slate-900 mb-2">Son Kabuller</h3>
          {customer.intakes.length === 0 ? (
            <div className="text-center py-8 text-slate-500 bg-white border border-slate-200 rounded-xl">
              <ClipboardList className="size-10 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">Henüz kabul formu yok</p>
              <Link href="/app/intakes/new" className="text-blue-600 hover:text-blue-700 text-sm">
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
                    className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{intake.vehicle.plate}</p>
                      <p className="text-xs text-slate-500">{intake.customerComplaint}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusInfo?.color || "bg-slate-100 text-slate-700"}`}>
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