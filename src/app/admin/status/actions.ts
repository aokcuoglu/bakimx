"use server"

import { revalidatePath } from "next/cache"
import { requireAdminCapability } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { getValidationError } from "@/lib/validations/shared"
import { createStatusIncidentSchema, resolveStatusIncidentSchema } from "@/lib/validations/status-incident"

type Result = { ok: true } | { ok: false; error: string }

/** Public sayfa `force-dynamic` olsa da, admin konsolundaki listenin de anında
 *  tazelenmesi için ikisi de revalidate edilir. */
function revalidateStatusPages() {
  revalidatePath("/admin/status")
  revalidatePath("/status")
}

export async function createStatusIncidentAction(raw: unknown): Promise<Result> {
  const ctx = await requireAdminCapability("manageStatusPage")

  const parsed = createStatusIncidentSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: getValidationError(parsed) ?? "Geçersiz olay bilgisi." }

  await prisma.statusIncident.create({
    data: {
      title: parsed.data.title,
      severity: parsed.data.severity,
      message: parsed.data.message,
      createdByEmail: ctx.user.email,
    },
  })

  revalidateStatusPages()
  return { ok: true }
}

export async function resolveStatusIncidentAction(raw: unknown): Promise<Result> {
  await requireAdminCapability("manageStatusPage")

  const parsed = resolveStatusIncidentSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: getValidationError(parsed) ?? "Geçersiz istek." }

  const incident = await prisma.statusIncident.findUnique({
    where: { id: parsed.data.incidentId },
    select: { id: true, resolvedAt: true },
  })
  if (!incident) return { ok: false, error: "Olay bulunamadı." }
  if (incident.resolvedAt) return { ok: false, error: "Olay zaten çözülmüş." }

  await prisma.statusIncident.update({
    where: { id: incident.id },
    data: {
      resolvedAt: new Date(),
      resolutionNote: parsed.data.resolutionNote || null,
    },
  })

  revalidateStatusPages()
  return { ok: true }
}
