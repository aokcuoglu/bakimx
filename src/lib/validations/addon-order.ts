import { z } from "zod/v4"
import { ADDON_ORDER_KEYS, isPerBranchAddon } from "@/lib/billing/addon-pricing"

export const addonOrderSchema = z.object({
  items: z
    .array(
      z.object({
        key: z.enum(ADDON_ORDER_KEYS),
        quantity: z.number().int("Adet tam sayı olmalı").min(1, "En az 1 adet").max(20, "En fazla 20 adet"),
      }),
    )
    .min(1, "En az bir ek özellik seçin")
    .max(3)
    .refine(
      (items) => items.every((i) => i.quantity === 1 || isPerBranchAddon(i.key)),
      "Bu ek özellik hesap başına tek adet satılır",
    )
    .refine((items) => new Set(items.map((i) => i.key)).size === items.length, "Aynı ek özellik birden fazla eklenemez"),
  method: z.enum(["card", "havale"]).default("havale"),
  invoiceTitle: z.string().min(2, "Fatura ünvanı zorunludur"),
  taxNumber: z.string().min(10, "Vergi/TC kimlik no zorunludur (en az 10 hane)"),
  taxOffice: z.string().optional().default(""),
})
export type AddonOrderValues = z.infer<typeof addonOrderSchema>
