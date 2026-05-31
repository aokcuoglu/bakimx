import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Plus, Car, Search } from "lucide-react"
import { Button } from "@/components/ui/button"

export default async function VehiclesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { user, workshop } = await getAppData()
  const params = await searchParams
  const query = params.q || ""

  const vehicles = await prisma.vehicle.findMany({
    where: {
      workshopId: user.workshopId,
      ...(query
        ? {
            OR: [
              { plate: { contains: query, mode: "insensitive" } },
              { brand: { contains: query, mode: "insensitive" } },
              { model: { contains: query, mode: "insensitive" } },
              { customer: { firstName: { contains: query, mode: "insensitive" } } },
              { customer: { lastName: { contains: query, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
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
            <Button size="lg" className="gap-2 h-12">
              <Plus className="size-5" />
              Yeni Araç
            </Button>
          </Link>
        </div>

        <form className="relative" action="/app/vehicles" method="get">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            name="q"
            defaultValue={query}
            placeholder="Plaka, marka, model veya müşteri adı ile arayın..."
            className="w-full h-12 pl-10 pr-4 rounded-xl border border-input bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </form>

        {vehicles.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Car className="size-14 mx-auto mb-4 opacity-20" />
            <p className="text-base font-medium">
              {query ? "Aramanızla eşleşen araç bulunamadı" : "Henüz araç kaydı yok"}
            </p>
            <Link href="/app/vehicles/new" className="text-primary hover:underline text-sm mt-3 inline-block">
              İlk aracınızı ekleyin
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {query && (
              <p className="text-xs text-muted-foreground px-1">
                {vehicles.length} araç bulundu
              </p>
            )}
            {vehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className="flex items-center justify-between p-4 bg-card border rounded-xl"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Car className="size-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {vehicle.plate} - {vehicle.brand} {vehicle.model}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
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
