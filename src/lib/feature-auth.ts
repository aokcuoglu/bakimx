import { requireFeatureWorkshop, requireWritableFeatureWorkshop } from "@/lib/auth"
import type { GatedFeature } from "@/lib/plan"
import type { Permission } from "@/lib/roles"

export function featureAuth(feature: GatedFeature) {
  return {
    async requireAuth() {
      return (await requireFeatureWorkshop(feature)).user
    },
    requireWritableWorkshop(permission: Permission) {
      return requireWritableFeatureWorkshop(permission, feature)
    },
  }
}
