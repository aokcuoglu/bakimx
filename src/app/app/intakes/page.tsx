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
    <AppShell workshopName={workshop?.name}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Araç Kabulleri</h2>
            <p className="text-muted-foreground">{intakes.length} kayıt</p>
          </div>
          <Link href="/app/intakes/new">
            <Button size="lg" className="gap-2">
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