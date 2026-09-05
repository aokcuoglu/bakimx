import { featureAuth } from "@/lib/feature-auth"

export const { requireAuth, requireWritableWorkshop } = featureAuth("cashbox")
