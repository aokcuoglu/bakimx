import { z } from "zod/v4"

export const notificationTemplateFormSchema = z.object({
  content: z.string().refine((v) => v.trim().length > 0, "Şablon metni boş olamaz"),
})

export type NotificationTemplateFormValues = z.infer<typeof notificationTemplateFormSchema>
