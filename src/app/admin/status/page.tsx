import { requireAdminCapability } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { StatusIncidentConsole } from "@/app/admin/status/status-incident-console"

export const dynamic = "force-dynamic"

export default async function AdminStatusPage() {
  await requireAdminCapability("manageStatusPage")

  const [incidents, activeIncidents] = await Promise.all([
    prisma.statusIncident.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.statusIncident.findMany({
      where: { resolvedAt: null },
      select: { severity: true },
    }),
  ])

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

  return (
    <StatusIncidentConsole
      incidents={rows}
      activeSeverities={activeIncidents.map((incident) => incident.severity)}
    />
  )
}
