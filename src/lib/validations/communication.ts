import { z } from "zod/v4"

export const customerPreferencesSchema = z.object({
  smsConsent: z.boolean().default(false),
  whatsappConsent: z.boolean().default(false),
  emailConsent: z.boolean().default(false),
})