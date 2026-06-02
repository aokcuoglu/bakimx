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
              { customer: { fullName: { contains: query, mode: "insensitive" } } },
              { customer: { companyName: { contains: query, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: { customer: true },
    orderBy: { createdAt: "desc" },
  })

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Araçlar">
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-center text-sm text-slate-500">
          <Link href="/app" className="hover:text-slate-700">Ana Panel</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700 font-medium">Araçlar</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Araçlar</h2>
            <p className="text-sm text-slate-500 mt-0.5">{vehicles.length} araç kayıtlı</p>
          </div>
          <Link href="/app/vehicles/new">
            <Button size="lg" className="gap-2 h-11">
              <Plus className="size-4" />
              Yeni Araç
            </Button>
          </Link>
        </div>

        <form className="relative" action="/app/vehicles" method="get">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            name="q"
            defaultValue={query}
            placeholder="Plaka, marka, model veya müşteri adı ile arayın..."
            className="w-full h-11 pl-10 pr-4 rounded-lg border border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
          />
        </form>

        {vehicles.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Car className="size-14 mx-auto mb-4 text-slate-300" />
            <p className="text-base font-medium">
              {query ? "Aramanızla eşleşen araç bulunamadı" : "Henüz araç kaydı yok"}
            </p>
            <Link href="/app/vehicles/new" className="text-blue-600 hover:text-blue-700 text-sm mt-3 inline-block">
              İlk aracınızı ekleyin
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {query && (
              <p className="text-xs text-slate-500 px-1">
                {vehicles.length} araç bulundu
              </p>
            )}
            {vehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="size-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                    <Car className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {vehicle.plate} • {vehicle.brand} {vehicle.model}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {vehicle.customer.type === "corporate"
                        ? vehicle.customer.companyName || "Kurumsal Müşteri"
                        : vehicle.customer.fullName || `${vehicle.customer.firstName ?? ""} ${vehicle.customer.lastName ?? ""}`.trim() || "Müşteri"}
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
