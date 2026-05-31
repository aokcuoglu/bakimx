import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Plus, Car } from "lucide-react"
import { Button } from "@/components/ui/button"

export default async function VehiclesPage() {
  const { user, workshop } = await getAppData()

  const vehicles = await prisma.vehicle.findMany({
    where: { workshopId: user.workshopId },
    include: { customer: true },
    orderBy: { createdAt: "desc" },
  })

  return (
    <AppShell workshopName={workshop?.name}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Araçlar</h2>
            <p className="text-muted-foreground">{vehicles.length} araç</p>
          </div>
          <Link href="/app/vehicles/new">
            <Button size="lg" className="gap-2">
              <Plus className="size-4" />
              Yeni Araç
            </Button>
          </Link>
        </div>

        {vehicles.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Car className="size-12 mx-auto mb-3 opacity-30" />
            <p>Henüz araç kaydı yok</p>
            <Link href="/app/vehicles/new" className="text-primary hover:underline text-sm mt-1 block">
              İlk aracınızı ekleyin
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {vehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className="flex items-center justify-between p-3 bg-card border rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <Car className="size-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {vehicle.plate} - {vehicle.brand} {vehicle.model}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {vehicle.customer.firstName} {vehicle.customer.lastName}
                      {vehicle.modelYear && ` • ${vehicle.modelYear}`}
                      {vehicle.mileage && ` • ${vehicle.mileage.toLocaleString("tr-TR")} km`}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}