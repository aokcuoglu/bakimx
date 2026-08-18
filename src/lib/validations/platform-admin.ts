import { z } from "zod"
import { ADMIN_ROLES } from "@/lib/admin-roles"

/**
 * Platform yöneticisi ekleme formu (BAK-93). Aynı şema hem istemcide (anlık geri
 * bildirim) hem sunucu action'ında (asıl kapı) kullanılır — kural tek kaynakta.
 */
export const addPlatformAdminSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "E-posta zorunludur")
    .email("Geçerli bir e-posta girin")
    .transform((v) => v.toLowerCase()),
  role: z.enum(ADMIN_ROLES, { message: "Geçersiz rol" }),
})

export type AddPlatformAdminValues = z.infer<typeof addPlatformAdminSchema>

export const platformAdminRoleSchema = z.enum(ADMIN_ROLES, { message: "Geçersiz rol" })
