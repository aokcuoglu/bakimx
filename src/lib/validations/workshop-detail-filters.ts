import { z } from "zod/v4"
import {
  BILLING_CYCLES,
  BILLING_ORDER_STATUSES,
  WORKSHOP_PLAN_TIERS,
} from "@/lib/admin/workshop-detail-query"

export const dateRangeValueSchema = z.object({
  from: z.date().optional(),
  to: z.date().optional(),
}).superRefine((value, ctx) => {
  if (value.from && value.to && value.from > value.to) {
    ctx.addIssue({
      code: "custom",
      message: "Başlangıç tarihi bitiş tarihinden sonra olamaz.",
    })
  }
})

export const usageDateFilterSchema = z.object({
  range: dateRangeValueSchema.optional(),
})

export const workshopOrderFilterSchema = z.object({
  range: dateRangeValueSchema.optional(),
  status: z.union([z.enum(BILLING_ORDER_STATUSES), z.literal("")]),
  plan: z.union([z.enum(WORKSHOP_PLAN_TIERS), z.literal("")]),
  cycle: z.union([z.enum(BILLING_CYCLES), z.literal("")]),
})

export type UsageDateFilterValues = z.infer<typeof usageDateFilterSchema>
export type WorkshopOrderFilterValues = z.infer<typeof workshopOrderFilterSchema>
