import { z } from "zod"

export const designPreviewSchema = z.object({
  title: z.string().trim().min(1, "Bir başlık girin."),
  description: z.string(),
  duration: z.enum(["30", "60"]),
})
export type DesignPreviewValues = z.infer<typeof designPreviewSchema>
