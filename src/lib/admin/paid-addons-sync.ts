import { pickAccountWorkshopId } from "../billing/account-pick"
import { isAddonOrderKey, paidAddonKeysAfterFeatureChange } from "../billing/addon-pricing"
import type { AddonFeature } from "../plan"

export interface PaidAddonsClient {
  workshop: {
    findUnique(args: {
      where: { id: string }
      select: { id: true; organizationId: true; createdAt: true; paidAddons: true }
    }): Promise<{ id: string; organizationId: string | null; createdAt: Date; paidAddons: string[] } | null>
    findMany(args: {
      where: { organizationId: string; kind: "customer" }
      select: { id: true; organizationId: true; createdAt: true; paidAddons: true }
    }): Promise<{ id: string; organizationId: string | null; createdAt: Date; paidAddons: string[] }[]>
  }
}

/**
 * Admin ek özellikleri kaydettikten sonra hesap atölyesinin `paidAddons`'u
 * (#1049): özellikleri kapatılan satın alınmış anahtar sonraki yenilemede
 * tahsil edilmez. Değişen bir şey yoksa `null`; aksi halde yazılacak kayıt.
 * `scripts/workshop-admin.ts` ile paylaşılır — bu yüzden `@/lib/db`ye bağlı değildir.
 */
export async function planPaidAddonsAfterAdminChange(
  db: PaidAddonsClient,
  workshopId: string,
  after: readonly AddonFeature[],
): Promise<{ accountId: string; paidAddons: string[]; removed: string[] } | null> {
  const select = { id: true, organizationId: true, createdAt: true, paidAddons: true } as const
  const workshop = await db.workshop.findUnique({ where: { id: workshopId }, select })
  if (!workshop) return null
  const rows = workshop.organizationId
    ? await db.workshop.findMany({ where: { organizationId: workshop.organizationId, kind: "customer" }, select })
    : []
  const pool = rows.length > 0 ? rows : [workshop]
  const account = pool.find((r) => r.id === pickAccountWorkshopId(pool)) ?? workshop
  const current = account.paidAddons.filter(isAddonOrderKey)
  const kept = paidAddonKeysAfterFeatureChange(current, after)
  if (kept.length === account.paidAddons.length) return null
  return {
    accountId: account.id,
    paidAddons: kept,
    removed: account.paidAddons.filter((k) => !(kept as string[]).includes(k)),
  }
}
