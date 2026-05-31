import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { ClipboardList, Car, Users, Wrench, CheckCircle2, AlertCircle } from "lucide-react"
import { INTAKE_STATUS } from "@/lib/constants"

export default async function DashboardPage() {
  const { user, workshop } = await getAppData()

  const [intakes, customersCount, vehiclesCount, recentIntakes] = await Promise.all([
    prisma.vehicleIntakeForm.count({ where: { workshopId: user.workshopId } }),
    prisma.customer.count({ where: { workshopId: user.workshopId } }),
    prisma.vehicle.count({ where: { workshopId: user.workshopId } }),
    prisma.vehicleIntakeForm.findMany({
      where: { workshopId: user.workshopId },
      include: { customer: true, vehicle: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ])

  const waitingApproval = await prisma.vehicleIntakeForm.count({
    where: { workshopId: user.workshopId, status: "waiting_approval" },
  })
  const delivered = await prisma.vehicleIntakeForm.count({
    where: { workshopId: user.workshopId, status: "delivered" },
  })

  return (
    <AppShell workshopName={workshop?.name}>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Hoş Geldiniz, {user.firstName || user.email}</h2>
          <p className="text-muted-foreground">{workshop?.name} paneli</p>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Link
            href="/app/intakes/new"
            className="flex flex-col items-center gap-2 p-4 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
          >
            <ClipboardList className="size-8" />
            <span className="text-sm font-medium">Yeni Araç Kabulü</span>
          </Link>
          <Link
            href="/app/intakes?status=waiting_approval"
            className="flex flex-col items-center gap-2 p-4 bg-yellow-50 text-yellow-800 rounded-xl hover:bg-yellow-100 transition-colors border border-yellow-200"
          >
            <AlertCircle className="size-8" />
            <span className="text-sm font-medium">Onay Bekleyenler</span>
            {waitingApproval > 0 && (
              <span className="text-xs bg-yellow-200 px-2 py-0.5 rounded-full">{waitingApproval}</span>
            )}
          </Link>
          <Link
            href="/app/intakes?status=delivered"
            className="flex flex-col items-center gap-2 p-4 bg-green-50 text-green-800 rounded-xl hover:bg-green-100 transition-colors border border-green-200"
          >
            <CheckCircle2 className="size-8" />
            <span className="text-sm font-medium">Teslim Edilenler</span>
            {delivered > 0 && (
              <span className="text-xs bg-green-200 px-2 py-0.5 rounded-full">{delivered}</span>
            )}
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <ClipboardList className="size-4" />
              <span className="text-xs">Toplam Kabul</span>
            </div>
            <p className="text-2xl font-bold">{intakes}</p>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="size-4" />
              <span className="text-xs">Müşteri</span>
            </div>
            <p className="text-2xl font-bold">{customersCount}</p>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Car className="size-4" />
              <span className="text-xs">Araç</span>
            </div>
            <p className="text-2xl font-bold">{vehiclesCount}</p>
          </div>
          <div className="bg-card border rounded-xl p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Wrench className="size-4" />
              <span className="text-xs">Onay Bekleyen</span>
            </div>
            <p className="text-2xl font-bold">{waitingApproval}</p>
          </div>
        </div>

        {/* Recent activity */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Son İşlemler</h3>
          {recentIntakes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardList className="size-12 mx-auto mb-3 opacity-30" />
              <p>Henüz araç kabul formu yok</p>
              <Link href="/app/intakes/new" className="text-primary hover:underline text-sm mt-1 block">
                İlk kabul formunu oluşturun
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentIntakes.map((intake) => {
                const statusInfo = INTAKE_STATUS[intake.status as keyof typeof INTAKE_STATUS]
                return (
                  <Link
                    key={intake.id}
                    href={`/app/intakes/${intake.id}`}
                    className="flex items-center justify-between p-3 bg-card border rounded-xl hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Car className="size-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">
                          {intake.vehicle.plate} - {intake.customer.firstName} {intake.customer.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {intake.vehicle.brand} {intake.vehicle.model}
                        </p>
                      </div>
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