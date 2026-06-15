import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Plus, ScanLine } from "lucide-react"
import { VehicleList } from "@/components/app/vehicle-list"
import { customerDisplayName } from "@/lib/format"
import { deleteVehicleAction } from "./actions"

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; vehicleType?: string; brand?: string }>
}) {
  const { user, workshop } = await getAppData()
  const params = await searchParams
  const q = (params.q || "").trim()
  const vehicleType = (params.vehicleType || "").trim()
  const brand = (params.brand || "").trim()

  const vehicles = await prisma.vehicle.findMany({
    where: {
      workshopId: user.workshopId,
      ...(vehicleType ? { vehicleType } : {}),
      ...(brand ? { brand } : {}),
      ...(q
        ? {
            OR: [
              { plate: { contains: q, mode: "insensitive" as const } },
              { brand: { contains: q, mode: "insensitive" as const } },
              { model: { contains: q, mode: "insensitive" as const } },
              { customer: { firstName: { contains: q, mode: "insensitive" as const } } },
              { customer: { lastName: { contains: q, mode: "insensitive" as const } } },
              { customer: { fullName: { contains: q, mode: "insensitive" as const } } },
              { customer: { companyName: { contains: q, mode: "insensitive" as const } } },
              { customer: { phone: { contains: q } } },
            ],
          }
        : {}),
    },
    include: {
      customer: true,
      intakes: {
        include: { order: { select: { id: true, status: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const brands = [...new Set(vehicles.map((v) => v.brand).filter(Boolean))].sort()

  const activeVehicleCount = vehicles.filter((v) =>
    v.intakes.some((i) => i.order && !["delivered", "cancelled"].includes(i.order.status))
  ).length

  const vehicleKpis = {
    total: vehicles.length,
    active: activeVehicleCount,
    documentsExpiring: 0,
    serviceDue: 0,
  }

  const serialized = vehicles.map((v) => ({
    id: v.id,
    plate: v.plate,
    brand: v.brand,
    model: v.model,
    vehicleType: v.vehicleType,
    modelYear: v.modelYear,
    mileage: v.mileage,
    createdAt: v.createdAt.toISOString(),
    customer: {
      id: v.customer.id,
      displayName: customerDisplayName(v.customer),
      phone: v.customer.phone,
      type: v.customer.type,
    },
    workOrdersCount: v.intakes.filter((i) => i.order).length,
    lastServiceDate: v.intakes[0]?.createdAt.toISOString() || null,
  }))

  return (
    <AppShell
      workshopName={workshop?.name}
      pageTitle="Araçlar"
      pageActions={
        <Link
          href="/app/vehicles/new"
          className="inline-flex items-center justify-center size-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white touch-manipulation"
          aria-label="Yeni araç"
        >
          <Plus className="size-5" />
        </Link>
      }
    >
      <div className="space-y-5 sm:space-y-6">
        <div className="hidden sm:flex items-center justify-between">
          <div className="flex items-center text-sm text-slate-500">
            <Link href="/app" className="hover:text-slate-700">Ana Panel</Link>
            <span className="mx-2">/</span>
            <span className="text-slate-700 font-medium">Araçlar</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Araçlar</h2>
            <p className="text-sm text-slate-500 mt-0.5">{vehicles.length} araç kayıtlı</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled
              title="Plaka tanıma entegrasyonu yakında"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-slate-200 bg-white text-slate-400 text-sm font-medium cursor-not-allowed touch-manipulation"
            >
              <ScanLine className="size-4" />
              <span className="hidden sm:inline">Plaka Tara</span>
            </button>
            <Link
              href="/app/vehicles/new"
              className="hidden sm:inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors touch-manipulation"
            >
              <Plus className="size-4" />
              Yeni Araç
            </Link>
          </div>
        </div>

        <div className="hidden sm:block text-xs text-slate-400 -mt-2">
          Plaka tanıma entegrasyonu yakında.
        </div>

        <VehicleList
          vehicles={serialized}
          brands={brands}
          initialFilters={{ q, vehicleType, brand }}
          kpis={vehicleKpis}
          onDelete={deleteVehicleAction}
        />
      </div>
    </AppShell>
  )
}
