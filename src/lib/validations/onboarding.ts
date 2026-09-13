import { z } from "zod/v4"
import {
  BUSINESS_FEATURE_IDS,
  REGISTER_MODULE_IDS,
  REGISTER_SECTOR_IDS,
  SETUP_PREFERENCE_IDS,
  TEAM_SIZE_IDS,
} from "@/lib/register-onboarding"

export const onboardingSchema = z.object({
  sector: z.enum(REGISTER_SECTOR_IDS),
  businessFeatures: z.array(z.enum(BUSINESS_FEATURE_IDS)).max(BUSINESS_FEATURE_IDS.length),
  teamSize: z.enum(TEAM_SIZE_IDS),
  selectedModules: z.array(z.enum(REGISTER_MODULE_IDS)).min(1).max(REGISTER_MODULE_IDS.length),
  setupPreference: z.enum(SETUP_PREFERENCE_IDS),
}).strict()

/** Only explicitly pending registrations enter the new flow; legacy accounts do not. */
export function isOnboardingPending(profile: unknown): boolean {
  return typeof profile === "object" && profile !== null &&
    "status" in profile && profile.status === "pending"
}
