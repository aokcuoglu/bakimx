import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { IntakeList } from "@/components/app/intake-list"

export default async function IntakesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { user, workshop } = await getAppData()
  const params = await searchParams
  const statusFilter = params.status || undefined

  const intakes = await prisma.vehicleIntakeForm.findMany({
    where: {
      workshopId: user.workshopId,
      ...(statusFilter ? { status: statusFilter as import("@prisma/client").IntakeStatus } : {}),
    },
    include: { customer: true, vehicle: true },
    orderBy: { createdAt: "desc" },
  })

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Araç Kabulleri">
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-center text-sm text-slate-500">
          <Link href="/app" className="hover:text-slate-700">Ana Panel</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700 font-medium">Araç Kabulleri</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Araç Kabulleri</h2>
            <p className="text-sm text-slate-500 mt-0.5">{intakes.length} kayıt</p>
          </div>
          <Link href="/app/intakes/new">
            <Button size="lg" className="gap-2 h-11">
              <Plus className="size-4" />
              Yeni Kabul
            </Button>
          </Link>
        </div>

        <IntakeList intakes={intakes} />
      </div>
    </AppShell>
  )
}