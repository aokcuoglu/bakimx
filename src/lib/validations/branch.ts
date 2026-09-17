import { z } from "zod/v4"
import {
  BUSINESS_FEATURE_IDS,
  REGISTER_MODULE_IDS,
  REGISTER_SECTOR_IDS,
  SETUP_PREFERENCE_IDS,
  TEAM_SIZE_IDS,
} from "@/lib/register-onboarding"

export const createBranchSchema = z.object({
  name: z.string().trim().min(2, "Şube adı en az 2 karakter olmalı").max(120),
  phone: z.string().trim().min(7, "Telefon gerekli").max(30),
  city: z.string().trim().min(2, "Şehir gerekli").max(80),
  district: z.string().trim().max(80).optional().or(z.literal("")),
  address: z.string().trim().min(3, "Adres gerekli").max(300),
  sector: z.enum(REGISTER_SECTOR_IDS),
  businessFeatures: z.array(z.enum(BUSINESS_FEATURE_IDS)).max(BUSINESS_FEATURE_IDS.length),
  teamSize: z.enum(TEAM_SIZE_IDS),
  selectedModules: z.array(z.enum(REGISTER_MODULE_IDS)).min(1).max(REGISTER_MODULE_IDS.length),
  setupPreference: z.enum(SETUP_PREFERENCE_IDS),
}).strict()

export type CreateBranchInput = z.infer<typeof createBranchSchema>

export const switchBranchSchema = z.object({
  workshopId: z.string().min(1),
}).strict()
