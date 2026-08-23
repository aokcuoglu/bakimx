import { z } from "zod"

export const marketResearchSchema = z.object({
  query: z.string().trim().min(2, "En az 2 karakter girin.").max(200),
  vehicle: z.string().trim().max(200),
  partNumbers: z.string().trim().max(300),
})

export const marketResearchCredentialSchema = z.object({
  apiKey: z.string().trim().min(20, "Geçerli bir Anthropic API anahtarı girin.").max(300),
})

export type MarketResearchValues = z.infer<typeof marketResearchSchema>
export type MarketResearchCredentialValues = z.infer<typeof marketResearchCredentialSchema>
