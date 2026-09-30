import { z } from "zod/v4"

export const createWorkshopTeamSchema = z.object({
  name: z.string().trim().min(2, "Ekip adı en az 2 karakter.").max(40, "Ekip adı en fazla 40 karakter."),
  description: z.string().max(160, "Açıklama en fazla 160 karakter."),
})
