import { z } from "zod"

export const STATUS_INCIDENT_SEVERITIES = ["degraded", "major_outage"] as const

export const createStatusIncidentSchema = z.object({
  title: z.string().trim().min(3, "Başlık en az 3 karakter olmalıdır").max(120),
  severity: z.enum(STATUS_INCIDENT_SEVERITIES, { message: "Geçersiz ciddiyet" }),
  message: z.string().trim().min(3, "Açıklama en az 3 karakter olmalıdır").max(2000),
})

export type CreateStatusIncidentInput = z.infer<typeof createStatusIncidentSchema>

export const resolveStatusIncidentSchema = z.object({
  incidentId: z.string().trim().min(1, "Olay seçilmedi"),
  resolutionNote: z.string().trim().max(2000).optional().default(""),
})

export type ResolveStatusIncidentInput = z.infer<typeof resolveStatusIncidentSchema>
