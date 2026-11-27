import { z } from "zod/v4"
import { BILLING_CYCLES } from "@/lib/admin/workshop-detail-query"

/**
 * Elle paket etkinleştirmede erişim süresi (#1040). Dönem ya da açık "süresiz"
 * seçimi zorunludur; ikisi birden ya da hiçbiri reddedilir, böylece dönem
 * bitişsiz (yanlışlıkla süresiz) bir abonelik yazılamaz.
 */
export const manualPlanActivationSchema = z
  .object({
    cycle: z.enum(BILLING_CYCLES, { error: "Geçersiz dönem." }).optional(),
    indefinite: z.boolean({ error: "Geçersiz süresiz erişim seçimi." }),
  })
  .superRefine((value, ctx) => {
    if (!value.cycle && !value.indefinite) {
      ctx.addIssue({ code: "custom", path: ["cycle"], message: "Dönem seçin (aylık / yıllık) ya da süresiz erişimi işaretleyin." })
    }
    if (value.cycle && value.indefinite) {
      ctx.addIssue({ code: "custom", path: ["cycle"], message: "Süresiz erişimde dönem seçilemez." })
    }
  })

export type ManualPlanActivationInput = z.infer<typeof manualPlanActivationSchema>
