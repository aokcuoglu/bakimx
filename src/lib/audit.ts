import { prisma } from "@/lib/db"

export async function AuditLogAction(
  workshopId: string,
  actorUserId: string | undefined,
  entityType: string,
  entityId: string,
  action: string,
  metadataJson?: string
) {
  await prisma.auditLog.create({
    data: {
      workshopId,
      actorUserId,
      entityType,
      entityId,
      action,
      metadataJson,
    },
  })
}