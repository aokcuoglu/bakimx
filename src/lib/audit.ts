import { prisma } from "@/lib/db"

export async function AuditLogAction(
  workshopId: string,
  actorUserId: string | undefined,
  entityType: string,
  entityId: string,
  action: string,
  metadataJson?: string,
  orderId?: string
) {
  await prisma.auditLog.create({
    data: {
      workshopId,
      actorUserId,
      entityType,
      entityId,
      action,
      metadataJson,
      orderId,
    },
  })

  // BAK-129 (Faz B): teknisyen Web Push'u aynı olay kaynağını kullanır — bu tek
  // yazım noktası. Dinamik import bilinçli: `web-push` yalnız Node tarafında
  // çözülmeli, bu dosya ise pek çok server action'dan statik olarak import
  // ediliyor. Gönderici hiçbir koşulda fırlatmaz (bkz. push-dispatch.ts).
  const { dispatchTechnicianPush } = await import("@/lib/technician/push-dispatch")
  await dispatchTechnicianPush({ workshopId, actorUserId, entityType, entityId, action, metadataJson, orderId })
}
