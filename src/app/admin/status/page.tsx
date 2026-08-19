import { requireAdminCapability } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { StatusIncidentConsole } from "@/app/admin/status/status-incident-console"

export const dynamic = "force-dynamic"

export default async function AdminStatusPage() {
  await requireAdminCapability("manageStatusPage")

  const incidents = await prisma.statusIncident.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  const rows = incidents.map((i) => ({
    id: i.id,
    title: i.title,
    severity: i.severity,
    message: i.message,
    createdByEmail: i.createdByEmail,
    resolvedAt: i.resolvedAt?.toISOString() ?? null,
    resolutionNote: i.resolutionNote,
    createdAt: i.createdAt.toISOString(),
  }))

  return <StatusIncidentConsole incidents={rows} />
}
