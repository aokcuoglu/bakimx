import { z } from "zod/v4"

export const notificationTemplateFormSchema = z.object({
  content: z.string().trim().min(1, "Şablon metni boş olamaz"),
})

export type NotificationTemplateFormValues = z.infer<typeof notificationTemplateFormSchema>
